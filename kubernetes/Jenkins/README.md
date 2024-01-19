1) Kubernetes setup in docker

2) Installs Jenkins
helm repo add jenkinsci https://charts.jenkins.io
helm repo update

kubectl create ns jenkins

kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/Jenkins/jenkins-sa.yaml
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/Jenkins/jenkins-volume.yaml

kubectl create secret docker-registry docker-credentials --docker-username= --docker-password= --docker-email=random@random.com --namespace jenkins

helm upgrade --install jenkins jenkinsci/jenkins -n jenkins -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/Jenkins/values.yaml
