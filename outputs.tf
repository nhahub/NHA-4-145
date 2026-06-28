output "jenkins_public_ip" {
  value = aws_instance.my_servers[0].public_ip
}

output "k8s_master_public_ip" {
  value = aws_instance.my_servers[1].public_ip
}

output "k8s_worker_public_ip" {
  value = aws_instance.my_servers[2].public_ip
}

output "jenkins_url" {
  value = "http://${aws_instance.my_servers[0].public_ip}:8080"
}