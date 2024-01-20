[First install argocd CLI](https://argo-cd.readthedocs.io/en/stable/cli_installation/)

Using Powershell:
``` 
kubectl create namespace argocd; kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl patch svc argocd-server -n argocd -p '{\"spec\": {\"type\": \"LoadBalancer\"}}'
kubectl patch svc argocd-server -n argocd --type='json' -p '[{"op": "replace", "path": "/spec/ports/0/port", "value": 81}]'                                                         
argocd admin initial-password -n argocd
$initial_password = (argocd admin initial-password -n argocd).Split("`n")[0].Trim()
argocd login localhost:80 --username admin --password $initial_password --insecure                    
argocd app create clustereye --repo https://github.com/urmas-villem/ClusterEye.git --path kubernetes --dest-server https://kubernetes.default.svc --dest-namespace default --sync-policy automated                                                                         
``` 
