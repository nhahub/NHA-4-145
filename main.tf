# ==================== AMI Dynamic Search ====================
data "aws_ami" "centos_stream" {
  most_recent = true
  owners      = ["125523088429"] # هذا هو الـ ID الرسمي لـ CentOS في AWS

  filter {
    name   = "name"
    values = ["CentOS Stream 9*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}
# ==================== SSH KEY UPLOAD ====================
resource "aws_key_pair" "depi_key" {
  key_name   = "depi_key"
  public_key = file("C:/Users/Salma/.ssh/depi_key.pub")
}
# ==================== NETWORK ====================

resource "aws_vpc" "depi_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "DEPI-GitOps-VPC"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.depi_vpc.id

  tags = {
    Name = "DEPI-Gateway"
  }
}

resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.depi_vpc.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "DEPI-Public-Subnet"
  }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.depi_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public_assoc" {
  subnet_id      = aws_subnet.public_subnet.id
  route_table_id = aws_route_table.public_rt.id
}

# ==================== SECURITY GROUPS ====================

resource "aws_security_group" "devops_sg" {
  name        = "depi-devops-sg"
  description = "Security Group for CI/CD and K8s Clusters"
  vpc_id      = aws_vpc.depi_vpc.id

  # --- SSH ---
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- Jenkins ---
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- App/Other Services ---
  ingress {
    from_port   = 9000
    to_port     = 9000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- K8s API Server ---
  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- Internal Communication (Crucial for K8s) ---
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true 
  }

  # --- Allow Outbound ---
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ==================== COMPUTING (3 السيرفرات) ====================
locals {
  server_names = ["Jenkins-CI-CD", "K8s-Master", "K8s-Worker"]
  
  jenkins_script = <<-EOF
  #!/bin/bash
  # تحديث النظام
  sudo dnf update -y
  
  # تثبيت الجافا (الإصدار المطلوب لـ Jenkins)
  sudo dnf install java-17-openjdk -y
  
  # تحميل وإضافة مستودع جينكنز
  sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
  sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
  
  # تثبيت جينكنز
  sudo dnf install jenkins -y
  
  # ضبط الأذونات والتشغيل
  sudo systemctl daemon-reload
  sudo systemctl enable jenkins
  sudo systemctl start jenkins
  
  # الانتظار للتأكد من إنشاء ملف الـ password
  sleep 30
  EOF
}

resource "aws_instance" "my_servers" {
  count                       = length(local.server_names)
  ami                         = data.aws_ami.centos_stream.id
  instance_type               = var.jenkins_instance_type 
  subnet_id                   = aws_subnet.public_subnet.id
  vpc_security_group_ids      = [aws_security_group.devops_sg.id]
  key_name                    = aws_key_pair.depi_key.key_name
  associate_public_ip_address = true 
  depends_on                  = [aws_key_pair.depi_key] 

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = local.server_names[count.index] == "Jenkins-CI-CD" ? local.jenkins_script : null
  
  tags = {
    Name = "DEPI-${local.server_names[count.index]}"
  }
}