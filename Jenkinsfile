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
        ARGOCD_URL = "http://argocd-server:81"
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
                    def response = sh(script: "curl -X POST ${ARGOCD_URL}/api/v1/applications/${APP_NAME}/actions/run", 
                                        returnStatus: true,
                                        input: "{\"action\": \"restart\", \"kind\": \"Deployment\"}")

                    if (response == 0) {
                        echo "ArgoCD action 'restart' triggered successfully for '${APP_NAME}'."
                    } else {
                        error "Failed to trigger ArgoCD action."
                    }
                }
            }
        }
    }
}
