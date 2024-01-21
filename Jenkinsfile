pipeline {
    agent {
        kubernetes {
            yamlFile 'kaniko-builder.yaml'
        }
    }

    environment {
        APP_NAME = "ClusterEye"
        RELEASE = "v1.0"
        IMAGE_NAME = "huxlee" + "/" + "clustereye"
        IMAGE_TAG = "${RELEASE}.${BUILD_NUMBER}"
        ARGOCD_SERVICE_NAME = "argocd-server"
        ARGOCD_PORT = "81"
        ARGOCD_NAMESPACE = "argocd"
        ARGOCD_URL = "http://${ARGOCD_SERVICE_NAME}.${ARGOCD_NAMESPACE}.svc.cluster.local:${ARGOCD_PORT}"
    }


    stages {
        stage("Cleanup Workspace") {
            steps {
                cleanWs()
            }
        }

        stage("Checkout from SCM") {
            steps {
                git branch: 'main', credentialsId: 'github', url: 'https://github.com/urmas-villem/ClusterEye'
            }
        }

        stage('Build & Push with Kaniko') {
            steps {
                container(name: 'kaniko', shell: '/busybox/sh') {
                    sh '''#!/busybox/sh
                    /kaniko/executor --dockerfile `pwd`/dockerfile --context `pwd` --destination=${IMAGE_NAME}:${IMAGE_TAG} --destination=${IMAGE_NAME}:latest
                    '''
                }
            }
        }

        stage('Trigger ArgoCD Restart') {
            steps {
                script {
                    def argoCdCommand = "argocd app actions run clustereye restart --kind Deployment"
                    sh """
                        set +e
                        $argoCdCommand
                        exitCode=\$?
                        set -e
                        if [ \$exitCode -eq 0 ]; then
                            echo "ArgoCD restart action triggered successfully."
                        else
                            echo "Failed to trigger ArgoCD restart action."
                            currentBuild.result = 'FAILURE'
                        fi
                    """
                }
            }
        }
    }
}
