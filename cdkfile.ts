import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as codedeploy from '@aws-cdk/aws-codedeploy';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { CodePipeline, CodePipelineSource } from '@aws-cdk/pipelines';
import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';

export class CdkEcsAlbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE,
        },
      ],
    });

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'MyCluster', {
      vpc,
    });

    // Create an ECS task definition
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'MyTaskDefinition', {
      networkMode: ecs.NetworkMode.AWS_VPC,
    });
    taskDefinition.addContainer('MyContainer', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // Create ECS service
    const service = new ecs.Ec2Service(this, 'MyService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE },
    });

    // Set up CodeDeploy deployment controller for ECS service
    const deploymentController = {
      type: ecs.DeploymentControllerType.CODE_DEPLOY,
    };
    service.configureAwsVpcNetworking({
      assignPublicIp: false,
    });

    // Create a Load Balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'MyLB', {
      vpc,
      internetFacing: true,
    });
    const listener = lb.addListener('Listener', {
      port: 8080,
    });
    listener.addTargets('ECS', {
      port: 8080,
      targets: [service],
    });

    // Output the ALB endpoint
    new cdk.CfnOutput(this, 'ALBEndpoint', {
      value: lb.loadBalancerDnsName,
    });

    // Create ECR repository for Docker image
    const ecr = new DockerImageAsset(this, 'MyECR', {
      directory: './docker',
    });

    // Create CodeDeploy application
    const codeDeployApp = new codedeploy.ServerApplication(this, 'CodeDeployApp');

    // Create CodeDeploy group
    const codeDeployGroup = new codedeploy.ServerDeploymentGroup(this, 'CodeDeployGroup', {
      application: codeDeployApp,
      deploymentConfig: codedeploy.ServerDeploymentConfig.ALL_AT_ONCE,
      autoScalingGroups: [service.autoScalingGroup],
    });

    // Create CodePipeline
    const pipeline = new CodePipeline(this, 'MyPipeline', {
      pipelineName: 'MyPipeline',
    });

    // Add source stage to pipeline
    const sourceOutput = new Artifact();
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new CodePipelineSource({
          actionName: 'SourceAction',
          output: sourceOutput,
          artifact: Artifact.artifact('Source'),
          repo: 'https://github.com/Pran2311/Aws-CDK-Task.git',
        }),
      ],
    });

    // Add build stage to pipeline
    const buildOutput = new Artifact();
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codedeploy.ServerDeployAction({
          actionName: 'DeployAction',
          input: sourceOutput,
          deploymentGroup: codeDeployGroup,
        }),
      ],
    });
  }
}

