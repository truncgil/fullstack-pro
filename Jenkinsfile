// Global Variable so it can be changed between stages
def GIT_BRANCH_NAME=getGitBranchName()

pipeline {
  agent {
    kubernetes{
      label 'slave-2cpu-8gb'
    }
  }
  parameters {
    string(name: 'REPOSITORY_SERVER', defaultValue: 'gcr.io/stack-test-186501', description: 'Registry server URL to pull/push images', trim: true)
    string(name: 'NAMESPACE', defaultValue: 'default', description: 'In which namespace micro services needs to be deploy', trim: true)
    string(name: 'CONNECTION_ID', defaultValue: 'test', description: 'connection id', trim: true)
    string(name: 'WORKSPACE_ID', defaultValue: 'fullstack-pro', description: 'workspace id', trim: true)
    string(name: 'UNIQUE_NAME', defaultValue: 'default', description: 'chart name', trim: true)
    string(name: 'HEMERA_LOG_LEVEL', defaultValue: 'info', description: 'log level for hemera')
    string(name: 'LOG_LEVEL', defaultValue: 'info', description: 'log level')
    string(name: 'DEPLOYMENT_PATH', defaultValue: '/servers', description: 'folder path to load helm charts')
    string(name: 'PUBLISH_BRANCH', defaultValue: 'devpublish', description: 'publish branch')
    string(name: 'EXCLUDE_SETTING_NAMESPACE_FILTER', defaultValue: 'brigade', description: 'exclude setting namespace that matches search string')
    string(name: 'GIT_CREDENTIAL_ID', defaultValue: 'fullstack-pro-github-deploy-key', description: 'jenkins credential id of git deploy secret')
    string(name: 'REPOSITORY_SSH_URL', defaultValue: 'git@github.com:cdmbase/fullstack-pro.git', description: 'ssh url of the git repository')
    string(name: 'REPOSITORY_BRANCH', defaultValue: 'develop', description: 'the branch of repository')
    string(name: 'DEVELOP_BRANCH', defaultValue: 'develop', description: 'Develop branch as default for the development.')
    string(name: 'MASTER_BRANCH', defaultValue: 'master', description: 'Master branch as default branch for production.')

    // by default first value of the choice will be choosen
    choice choices: ['auto', 'force'], description: 'Choose merge strategy', name: 'NPM_PUBLISH_STRATEGY'
    choice choices: ['yarn', 'npm'], description: 'Choose build strategy', name: 'BUILD_STRATEGY'
    choice choices: ['0.7.4', '0.6.0'], description: 'Choose Idestack chart version', name: 'IDESTACK_CHART_VERSION'
    choice choices: ['nodejs16', 'nodejs14'], description: 'Choose NodeJS version', name: 'NODEJS_TOOL_VERSION'    
    choice choices: ['buildOnly', 'buildAndTest', 'buildAndPublish',  'mobileBuild', 'mobilePreview', 'mobilePreviewLocal', 'mobileProd', 'mobileProdSubmit', 'devDeployOnly', 'stageDeploy', 'stageDeployOnly', 'prodDeploy', 'prodDeployOnly', 'allenv'], description: 'Where to deploy micro services?', name: 'ENV_CHOICE'
    choice choices: ['all', 'ios', 'android' ], description: 'Mobile type if it is mobile build?', name: 'MOBILE_CHOICE'
    booleanParam (defaultValue: false, description: 'Skip production release approval', name: 'SKIP_RELEASE_APPROVAL')
    booleanParam (defaultValue: false, description: 'Tick to enable debug mode', name: 'ENABLE_DEBUG')
    string(name: 'BUILD_TIME_OUT', defaultValue: '120', description: 'Build timeout in minutes', trim: true)
  }

  // Setup common + secret key variables for pipeline.
  environment {
    BUILD_COMMAND = getBuildCommand()
    PYTHON='/usr/bin/python'
    GCR_KEY = credentials('jenkins-gcr-login-key')
    EXPO_TOKEN = credentials('expo_cdmbase_token')
    GIT_PR_BRANCH_NAME = getGitPrBranchName()
    GITHUB_HELM_REPO_TOKEN = credentials('github-helm-repo-access-token')
  }

  // Initialize npm and docker commands using plugins
  tools {
    nodejs params.NODEJS_TOOL_VERSION
  }

  stages {

    stage('define environment') {
      steps {
        // skip the build if ends with `[skip ci]` which is equivalent to regex `.*\[skip ci\]$`
        scmSkip(deleteBuild: true, skipPattern:'.*\\[skip ci\\]\\s')
        checkout([$class: 'GitSCM', branches: [[name: '*/'+ params.REPOSITORY_BRANCH]],
        doGenerateSubmoduleConfigurations: false, extensions: [[$class: 'WipeWorkspace']],
        submoduleCfg: [], userRemoteConfigs: [[credentialsId: params.GIT_CREDENTIAL_ID, url: params.REPOSITORY_SSH_URL]]])
        sh "git checkout ${env.GIT_PR_BRANCH_NAME}"
      }
    }

    stage('Unlock secrets'){ //unlock keys for all runs
      environment{ deployment_env = 'dev' }
      steps{
        sh '''
           gpg --import /tmp/gpg-public-key/gpg-public-key.pub
           gpg --import /tmp/gpg-private-key/gpg-private-key.key
           git-crypt unlock
        '''
        load "./jenkins_variables.groovy"
        // if we need to load stag configuration for different location.
        // sh "curl -H 'Authorization: token ${env.GITHUB_ACCESS_TOKEN}' -H 'Accept: application/vnd.github.v3.raw' -O -L https://raw.githubusercontent.com/cdmbase/kube-orchestration/master/idestack/values-stage.yaml"
      }
    }

    // Install packages. If
    // a. any branch
    // b. ENV_CHOICE set not selected `dev`, `stage` or `prod`
    stage ('Install git repository'){
       steps{
          sh """
            echo "what is docker git version $GIT_BRANCH_NAME -- ${params.ENV_CHOICE}"
            ${params.BUILD_STRATEGY} install
            ${params.BUILD_STRATEGY} run lerna
          """
       }
    }

    stage ('Mobile Build'){
      when {
        expression { params.ENV_CHOICE == 'mobileBuild' || params.ENV_CHOICE == 'mobilePreview' || params.ENV_CHOICE == 'mobilePreviewLocal' || params.ENV_CHOICE == 'mobileProd' || params.ENV_CHOICE == 'mobileProdSubmit' }
      }
      steps{
        sh """
            rm .npmrc
            lerna exec --scope=*mobile-device ${params.BUILD_STRATEGY} ${env.BUILD_COMMAND}
        """
      }
    }

    // Run build for all cases except when ENV_CHOICE is 'buildAndPublish' and `dev`, `stage` or `prod`
    stage ('Build Packages'){
      when {
        expression { params.ENV_CHOICE == 'buildOnly' || params.ENV_CHOICE == 'buildAndTest' || params.ENV_CHOICE == 'buildAndPublish' }
      }
      steps{
        sh """
          ${params.BUILD_STRATEGY} run build
        """
      }
    }

    // Test build for all cases except when ENV_CHOICE is 'buildAndPublish' and `dev`, `stage` or `prod`
    stage ('Test Packages'){
      when {
        expression { params.ENV_CHOICE == 'buildAndTest' }
      }
      steps{
        sh """
          ${params.BUILD_STRATEGY} run test
        """
      }
    }

    // if PR is from branch other than `develop` then merge to `develop` if we chose ENV_CHOICE as 'buildAndPublish'.
    // Skip this stage. Future implementation.
    stage ('Merge PR, Install, Build'){
      when {
        expression { params.ENV_CHOICE == '1' }
      }
      steps{
        sh """
          git checkout ${params.DEVELOP_BRANCH}
          git merge ${env.GIT_PR_BRANCH_NAME} -m 'auto merging ${params.GIT_PR_BRANCH_NAME} \r\n[skip ci]'
          git push origin ${params.DEVELOP_BRANCH}
          ${params.BUILD_STRATEGY} install
          ${params.BUILD_STRATEGY} run lerna
          ${params.BUILD_STRATEGY} run build
        """
        script {
          GIT_BRANCH_NAME = params.DEVELOP_BRANCH
        }
      }
    }

    // publish packages to npm repository.
    // commit new package-lock.json that might get generated during install
    // Build will be ignore with tag '[skip ci]'
    stage ('Publish Packages'){
      when {
        expression { GIT_BRANCH_NAME == params.DEVELOP_BRANCH }
        expression { params.ENV_CHOICE == 'buildOnly' ||  params.ENV_CHOICE == 'buildAndPublish' }
      }
      steps{
        script {
          GIT_BRANCH_NAME=params.PUBLISH_BRANCH
        }
        sshagent (credentials: [params.GIT_CREDENTIAL_ID]) {
          sh """
            git add -A
            git diff --staged --quiet || git commit -am 'auto build [skip ci] \r\n'
            git fetch origin ${params.DEVELOP_BRANCH}
            git checkout ${params.DEVELOP_BRANCH}
            ${params.BUILD_STRATEGY} run devpublish:${params.NPM_PUBLISH_STRATEGY};
            git push origin ${params.DEVELOP_BRANCH}
            git checkout ${params.PUBLISH_BRANCH}
          """
        }
      }
    }

    stage('Docker login'){
      steps{
        sh 'cat "$GCR_KEY" | docker login -u _json_key --password-stdin https://gcr.io'
      }
    }

    stage('Dev Docker Images') {
      options {
         timeout(time: params.BUILD_TIME_OUT, unit: 'MINUTES')
       }
      when {
        // Docker build need be performed in PUBLISH branch only
        expression { GIT_BRANCH_NAME == params.PUBLISH_BRANCH }
        expression { params.ENV_CHOICE == 'buildOnly' }
      }

      // Below variable is only set to load all (variables, functions) from jenkins_variables.groovy file.
      environment{ deployment_env = 'dev' }
        steps{
          load "./jenkins_variables.groovy"
          script {
            def servers = getDirs(pwd() + params.DEPLOYMENT_PATH)
            def parallelStagesMap = servers.collectEntries {
             ["${it}" : generateBuildStage(it)]
            }
            parallel parallelStagesMap
          }
        }
    }

    // Below are dev stages
    stage('Dev deployment') {
      environment{
          deployment_env = 'dev'
      }
      when {
        expression { GIT_BRANCH_NAME == params.PUBLISH_BRANCH ||  GIT_BRANCH_NAME == params.DEVELOP_BRANCH }
        expression { params.ENV_CHOICE == 'buildOnly' || params.ENV_CHOICE == 'devDeployOnly' }
        beforeInput true
      }

      steps {
       withKubeConfig([credentialsId: 'kubernetes-dev-cluster-r1', serverUrl: "https://34.74.64.165"]) {         
         sh """
            helm repo add stable https://charts.helm.sh/stable
            helm repo add incubator https://charts.helm.sh/incubator
            helm repo add kube-orchestration https://"""+ GITHUB_HELM_REPO_TOKEN +"""@raw.githubusercontent.com/cdmbase/kube-orchestration/develop/helm-packages
            helm repo update
         """
          script {

            nameSpaceCheck = sh(script: "kubectl get ns | tr '\\n' ','", returnStdout: true)
            if (!nameSpaceCheck.contains(params.NAMESPACE)) { sh "kubectl create ns " + params.NAMESPACE }

            def servers = getDirs(pwd() + params.DEPLOYMENT_PATH)
            def parallelStagesMap = servers.collectEntries {
             ["${it}" : generateStage(it, deployment_env)]
            }
            parallel parallelStagesMap
          }
        }
      }
    } // End of dev deployment code block.

    // Only master branch will be merged
    stage ('Merge Develop to master & Install'){
      when {
        expression { GIT_BRANCH_NAME == params.MASTER_BRANCH }
        expression { params.ENV_CHOICE == 'stageDeploy' || params.ENV_CHOICE == 'prodDeploy' }
      }
      steps{
        sh """
          git add -A
          git diff --staged --quiet || git commit -am 'pre merge to master \r\n[skip ci]'
          git checkout ${params.REPOSITORY_BRANCH}
          git merge origin/${params.DEVELOP_BRANCH} -m 'auto merging ${params.DEVELOP_BRANCH} \r\n[skip ci]'
          ${params.BUILD_STRATEGY} install
          ${params.BUILD_STRATEGY} run lerna
        """
        script {
          GIT_BRANCH_NAME = params.REPOSITORY_BRANCH
        }
      }
    }
  
    // Run build for all cases except when ENV_CHOICE is 'buildAndPublish' and `dev`, `stage` or `prod`
    stage ('Prod Build Packages'){
      when {
        expression { GIT_BRANCH_NAME == params.MASTER_BRANCH }
        expression { params.ENV_CHOICE == 'stageDeploy' || params.ENV_CHOICE == 'prodDeploy' }
      }
      steps{
        sh """
          ${params.BUILD_STRATEGY} run build
        """
      }
    }

    // publish packages to npm repository.
    // commit new package-lock.json that might get generated during install
    // Build will be ignore with tag '[skip ci]'
    stage ('Prod Publish Packages'){
      when {
        expression { GIT_BRANCH_NAME == params.MASTER_BRANCH }
        expression { params.ENV_CHOICE == 'stageDeploy' || params.ENV_CHOICE == 'prodDeploy' }
      }
      steps{
        script {
          GIT_BRANCH_NAME=params.PUBLISH_BRANCH
        }
        sshagent (credentials: [params.GIT_CREDENTIAL_ID]) {
          sh """
            git add -A
            git diff --staged --quiet || git commit -am 'auto build [skip ci]\r\n'
            git fetch origin ${params.MASTER_BRANCH}
            git checkout ${params.MASTER_BRANCH}
            ${params.BUILD_STRATEGY} run publish:${params.NPM_PUBLISH_STRATEGY};
            git push origin ${params.MASTER_BRANCH}
            git checkout ${params.PUBLISH_BRANCH}
          """
        }
      }
    }
  
    // Build Docker containers for production.
    stage('Prod Docker Images') {
      options {
         timeout(time: params.BUILD_TIME_OUT, unit: 'MINUTES')
       }
      when {
        // required to be in Publish branch to build docker
        expression { GIT_BRANCH_NAME == params.PUBLISH_BRANCH }
        expression { params.ENV_CHOICE == 'stageDeploy' || params.ENV_CHOICE == 'prodDeploy' }
      }

      // Below variable is only set to load all (variables, functions) from jenkins_variables.groovy file.
      environment{ deployment_env = 'prod' }
        steps{
          load "./jenkins_variables.groovy"
          script {
            def servers = getDirs(pwd() + params.DEPLOYMENT_PATH)
            def parallelStagesMap = servers.collectEntries {
             ["${it}" : generateBuildStage(it)]
            }
            parallel parallelStagesMap
          }
        }
    } // End of production docker build.

    // Below are stage code block
    stage('Stage Deployment') {
      options {
         timeout(time: 300, unit: 'SECONDS')
       }
      environment{
        deployment_env = 'stage'
      }
      when {
        expression { GIT_BRANCH_NAME == params.MASTER_BRANCH || GIT_BRANCH_NAME == params.PUBLISH_BRANCH }
        expression { params.ENV_CHOICE == 'stageDeploy' || params.ENV_CHOICE == 'stageDeployOnly' }
        beforeInput true
      }

      steps {
        load "./jenkins_variables.groovy"
        withKubeConfig([credentialsId: 'kubernetes-staging-cluster', serverUrl: 'https://35.231.34.237']) {
          sh """
            helm repo add stable https://charts.helm.sh/stable
            helm repo add incubator https://charts.helm.sh/incubator
            helm repo add kube-orchestration https://"""+ GITHUB_HELM_REPO_TOKEN +"""@raw.githubusercontent.com/cdmbase/kube-orchestration/develop/helm-packages
            helm repo update
          """
          script {
            nameSpaceCheck = sh(script: "kubectl get ns | tr '\\n' ','", returnStdout: true)
            if (!nameSpaceCheck.contains(params.NAMESPACE)) { sh "kubectl create ns " + params.NAMESPACE }

            def servers = getDirs(pwd() + params.DEPLOYMENT_PATH)
            def parallelStagesMap = servers.collectEntries {
              ["${it}" : generateStage(it, deployment_env)]
            }
            parallel parallelStagesMap
          }
        }
      }
    } // End of staging deployment code block.

    stage('Release?') {
      when {
        expression { GIT_BRANCH_NAME == params.PUBLISH_BRANCH }
        expression { params.ENV_CHOICE == 'prodDeploy' || params.ENV_CHOICE == 'prodDeployOnly' }
        expression { params.SKIP_RELEASE_APPROVAL == false }
      }
      options {
        // Optionally, let's add a timeout that we don't allow ancient
        // builds to be released.
        timeout time: 900, unit: 'SECONDS' 
      }
      steps {
        // Optionally, send some notifications to the approver before
        // asking for input. You can't do that with the input directive
        // without using an extra stage.
        slackSend (color: '#2596BE', message: "Approval Needed for Production Release:  Job  '${env.JOB_NAME}'  BUILD NUMBER:  '${env.BUILD_NUMBER}'  to be approved. Click <${env.RUN_DISPLAY_URL}|here> to approve it.", channel: 'idestack-automation')

        // The input statement has to go to a script block because we
        // want to assign the result to an environment variable. As we 
        // want to stay as declarative as possible, we put noting but
        // this into the script block.
        script {
          // Assign the 'DO_RELEASE' environment variable that is going
          //  to be used in the next stage.
          env.DO_RELEASE = input  message: 'Want to deploy fullstack-pro on prod cluster?',
                                        parameters:[choice(choices:  ['yes', 'no'], description: 'Deploy branch in Production?', name: 'PROD_DEPLOYMENT')]
        }
        // In case you approved multiple pipeline runs in parallel, this
        // milestone would kill the older runs and prevent deploying
        // older releases over newer ones.
        milestone 1
      }
    }
    // Below are production stages
    stage('Prod Deployment') {
      options {
        timeout(time: 300, unit: 'SECONDS')
      }
      environment{
        deployment_env = 'prod'
      }
      when {
        // Only execute the step when the release has been approved or skipped in the deployment.
        expression { env.DO_RELEASE == 'yes' || params.SKIP_RELEASE_APPROVAL == true }
        expression { GIT_BRANCH_NAME == params.PUBLISH_BRANCH }
        expression { params.ENV_CHOICE == 'prodDeploy' || params.ENV_CHOICE == 'prodDeployOnly' }
      }

      steps {
        // Make sure that only one release can happen at a time.
        lock('release') {
          // As using the first milestone only would introduce a race 
          // condition (assume that the older build would enter the 
          // milestone first, but the lock second) and Jenkins does
          // not support inter-stage locks yet, we need a second 
          // milestone to make sure that older builds don't overwrite
          // newer ones.
          milestone 2
          
          // Now do the actual work here
          load "./jenkins_variables.groovy"
          withKubeConfig([credentialsId: 'kubernetes-prod-cluster', serverUrl: 'https://35.229.71.215']) {
            sh """
               helm repo add stable https://charts.helm.sh/stable
               helm repo add incubator https://charts.helm.sh/incubator
               helm repo add kube-orchestration https://"""+ GITHUB_HELM_REPO_TOKEN +"""@raw.githubusercontent.com/cdmbase/kube-orchestration/develop/helm-packages
               helm repo update
             """
            script {
              nameSpaceCheck = sh(script: "kubectl get ns | tr '\\n' ','", returnStdout: true)
              if (!nameSpaceCheck.contains(params.NAMESPACE)) { sh "kubectl create ns " + params.NAMESPACE }
            
              def servers = getDirs(pwd() + params.DEPLOYMENT_PATH)
              def parallelStagesMap = servers.collectEntries {
                ["${it}" : generateStage(it, deployment_env)]
              }
              parallel parallelStagesMap

              slackSend (color: '#2596BE', message: "Done:  Job  '${env.JOB_NAME}'  BUILD NUMBER:  '${env.BUILD_NUMBER}'  is completed. click <${env.RUN_DISPLAY_URL}|here> to see the log.", channel: 'idestack-automation')
            }
          }
        }
      }
    } // End of production deployment code block.
  }

  post {
    always {
      deleteDir()
    }
    success{
      slackSend (color: '#00FF00', message: "SUCCESSFUL:  Job  '${env.JOB_NAME}'  BUILD NUMBER:  '${env.BUILD_NUMBER}'  Job success. click <${env.RUN_DISPLAY_URL}|here> to see the log.", channel: 'idestack-automation')
    }
    failure{
      slackSend (color: '#FF0000', message: "FAILED:  Job  '${env.JOB_NAME}'  BUILD NUMBER:  '${env.BUILD_NUMBER}'  Job failed. click <${env.RUN_DISPLAY_URL}|here> to see the log.", channel: 'idestack-automation')
    }
  }
}

def getBuildCommand(){
  if(params.ENV_CHOICE == 'mobileBuild'){
    return 'build:auto'
  }
  if(params.ENV_CHOICE == 'mobilePreview'){
    return 'build:preview:' + params.MOBILE_CHOICE
  }
  if(params.ENV_CHOICE == 'mobilePreviewLocal'){
    return 'build:previewLocal:' + params.MOBILE_CHOICE
  }
  if(params.ENV_CHOICE == 'mobileProd'){
    return 'build:prod:' + params.MOBILE_CHOICE
  }
  if(params.ENV_CHOICE == 'mobileProdSubmit'){
    return 'build:prodSubmit:' + params.MOBILE_CHOICE
  }
  if(params.ENABLE_DEBUG.toBoolean()){
    return 'build:debug'
  } else {
    return 'build'
  }
}

def getGitPrBranchName() {
  // The branch name could be in the BRANCH_NAME or GIT_BRANCH variable depending on the type of job
  //def branchName = env.BRANCH_NAME ? env.BRANCH_NAME : env.GIT_BRANCH
  //return branchName || ghprbSourceBranch
  if(env.ghprbSourceBranch){
    return env.ghprbSourceBranch
  } else {
    return params.REPOSITORY_BRANCH
  }
}

def getGitBranchName(){ // we can place some conditions in future
  if(env.ghprbSourceBranch){
    return env.ghprbSourceBranch
  } else {
    return params.REPOSITORY_BRANCH
  }
}

@NonCPS
//TODO: Fix below get method for Jenkins slave if possible.
def getDirs1(path){
  def currentDir = new File(path)
  def dirs = []
  currentDir.eachDir() {
      dirs << it.name
  }
  return dirs
}

// Below function to work in Jenkins slave
def getDirs(path){
    def currentDir = sh(script: "ls -CF "+path+" | tr '/' ' '", returnStdout: true)
    def dirs = []
    (currentDir.split()).each {
      dirs << "${it}"
    }
    return dirs
}

def generateStage(server, environmentType) {
  return {
    stage("stage: ${server}") {
      echo "This is ${server}."
      def filterExist = "${server}".contains(params.EXCLUDE_SETTING_NAMESPACE_FILTER)
      def namespace = filterExist ? '' : "--namespace=${params.NAMESPACE}"
      def name = getName(pwd() + "${params.DEPLOYMENT_PATH}/${server}/package.json")
      def version = getVersion(pwd() + params.DEPLOYMENT_PATH + "/${server}/package.json")
      def valuesFile = "values-${environmentType}.yaml"
      // deploy anything matching `*backend-server` or `*frontend-server` to use idestack chart
      try{
        if ("${server}".endsWith("backend-server") | "${server}".endsWith("frontend-server")) {
          echo "add deployment flag to - ${server} "

          if ("${server}".endsWith("frontend-server")){
            deployment_flag = " --set backend.enabled='false' --set external.enabled='true'"
          }

          if ("${server}".endsWith("backend-server")){
            deployment_flag = " --set frontend.enabled='false' --set external.enabled='false' --set ingress.enabled=false "
          }

          sh """
            helm upgrade -i \
            ${UNIQUE_NAME}-${server} \
            -f "${valuesFile}" \
            ${namespace} \
            ${deployment_flag} \
            --set frontend.image="${REPOSITORY_SERVER}/${name}" \
            --set frontend.imageTag=${version} \
            --set backend.image="${REPOSITORY_SERVER}/${name}" \
            --set backend.imageTag=${version} \
            --set settings.workspaceId="${WORKSPACE_ID}" \
            --set frontend.pullPolicy=Always \
            --set backend.pullPolicy=Always \
            --version=${IDESTACK_CHART_VERSION} \
              kube-orchestration/idestack
            """

        } else {
          sh """
            cd .${params.DEPLOYMENT_PATH}/${server}
            helm dependency update  charts/chart/
            helm upgrade -i \
            ${UNIQUE_NAME}-${server}-api \
            -f "charts/chart/${valuesFile}" \
            ${namespace} \
            --set global.image.repository=${REPOSITORY_SERVER}/${name} \
            --set global.image.tag=${version} \
            --version="v0.1.3" \
            charts/chart
          """

        }
      } catch (Exception err) {
        slackSend (color: '#FF0000', message: "FAILED:  Job  '${env.JOB_NAME}'  BUILD NUMBER:  '${env.BUILD_NUMBER}'  Job failed in stage deployment ${server}. click <${env.RUN_DISPLAY_URL}|here> to see the log. Error: ${err.toString()}", channel: 'idestack-automation')
        println err
        throw(err)
      }
    }
  }
}

// Docker build parllel loop
def generateBuildStage(server) {
  return {
    stage("stage: ${server}") {
     try{
      echo "This is ${server}."
      def name = getName(pwd() + params.DEPLOYMENT_PATH + "/${server}/package.json")
      def version = getVersion(pwd() + params.DEPLOYMENT_PATH + "/${server}/package.json")
        sh """
            lerna exec --scope=*${server} ${params.BUILD_STRATEGY} run docker:${env.BUILD_COMMAND};
            docker tag ${name}:${version} ${REPOSITORY_SERVER}/${name}:${version}
            docker push ${REPOSITORY_SERVER}/${name}:${version}
            docker rmi ${REPOSITORY_SERVER}/${name}:${version}
        """
      } catch (e) {
        slackSend (color: '#FF0000', message: "FAILED:  Job  '${env.JOB_NAME}'  BUILD NUMBER:  '${env.BUILD_NUMBER}'  Job failed in stage docker-build ${server}. click <${env.RUN_DISPLAY_URL}|here> to see the log. Error: ${e}", channel: 'idestack-automation')
        throw(e)
      }
    }
  }
}

import groovy.json.JsonSlurper
def getVersion(json_file_path){
  def inputFile = readFile(json_file_path)
  def InputJSON = new JsonSlurper().parseText(inputFile)
  def version = InputJSON.version
  return version
}

def getName(json_file_path){
  def inputFile = readFile(json_file_path)
  def InputJSON = new JsonSlurper().parseText(inputFile)
  def name = InputJSON.name
  return name
}
