``` 
helm repo add jenkinsci https://charts.jenkins.io
helm repo update
$dockerUsername = Read-Host "Enter Docker registry username"
$dockerPassword = Read-Host "Enter Docker registry password" -AsSecureString
kubectl create namespace jenkins
kubectl create secret docker-registry docker-credentials --docker-username=$dockerUsername --docker-password=$dockerPassword --docker-email=random@random.com --namespace jenkins
helm upgrade --install jenkins jenkinsci/jenkins -n jenkins -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/Jenkins/values.yaml
``` 
