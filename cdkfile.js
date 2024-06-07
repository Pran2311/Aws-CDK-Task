"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var cdk = require("@aws-cdk/core");
var ec2 = require("@aws-cdk/aws-ec2");
var ecs = require("@aws-cdk/aws-ecs");
var ecr = require("@aws-cdk/aws-ecr");
var elbv2 = require("@aws-cdk/aws-elasticloadbalancingv2");
var codedeploy = require("@aws-cdk/aws-codedeploy");
var codepipeline = require("@aws-cdk/aws-codepipeline");
var codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
var MyCdkStack = /** @class */ (function (_super) {
    __extends(MyCdkStack, _super);
    function MyCdkStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var vpc = new ec2.Vpc(_this, 'MyVpc', {
            maxAzs: 3,
            subnetConfiguration: [
                { cidrMask: 24, name: 'PublicSubnet', subnetType: ec2.SubnetType.PUBLIC },
                { cidrMask: 24, name: 'PrivateSubnet', subnetType: ec2.SubnetType.PRIVATE },
            ],
        });
        var cluster = new ecs.Cluster(_this, 'MyCluster', { vpc: vpc });
        var repository = new ecr.Repository(_this, 'MyRepository');
        var taskDefinition = new ecs.Ec2TaskDefinition(_this, 'MyTaskDefinition', {
            memoryMiB: '512',
            cpu: '256',
        });
        var container = taskDefinition.addContainer('MyContainer', {
            image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
            memoryLimitMiB: 512,
            cpu: 256,
        });
        var service = new ecs.Ec2Service(_this, 'MyService', {
            cluster: cluster,
            taskDefinition: taskDefinition,
            desiredCount: 2,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE },
        });
        var alb = new elbv2.ApplicationLoadBalancer(_this, 'MyALB', {
            vpc: vpc,
            internetFacing: true,
        });
        var listener = alb.addListener('Listener', {
            port: 80,
            defaultAction: elbv2.ListenerAction.fixedResponse(200, {
                contentType: 'text/plain',
                messageBody: 'Hello, CDK!',
            }),
        });
        var deploymentGroup = codedeploy.EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(_this, 'MyDeploymentGroup', {
            applicationName: 'MyApplication',
            deploymentGroupName: 'MyDeploymentGroup',
            deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
            targetGroup: elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(_this, 'TargetGroup', {
                targetGroupArn: listener.loadBalancerArn,
            }),
        });
        var pipeline = new codepipeline.Pipeline(_this, 'MyPipeline', {
            restartExecutionOnUpdate: true,
        });
        var sourceOutput = new codepipeline.Artifact();
        var buildOutput = new codepipeline.Artifact();
        var sourceStage = pipeline.addStage({
            stageName: 'Source',
            actions: [
                new codepipeline_actions.CodeCommitSourceAction({
                    actionName: 'Source',
                    repository: repository,
                    output: sourceOutput,
                }),
            ],
        });
        var buildProject = new codebuild.Project(_this, 'MyBuildProject', {
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
        });
        var buildStage = pipeline.addStage({
            stageName: 'Build',
            actions: [
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'Build',
                    project: buildProject,
                    input: sourceOutput,
                    outputs: [buildOutput],
                }),
            ],
        });
        var deployStage = pipeline.addStage({
            stageName: 'Deploy',
            actions: [
                new codepipeline_actions.CodeDeployEcsDeployAction({
                    actionName: 'Deploy',
                    deploymentGroup: deploymentGroup,
                    taskDefinitionTemplateInput: buildOutput,
                }),
            ],
        });
        return _this;
    }
    return MyCdkStack;
}(cdk.Stack));
var app = new cdk.App();
new MyCdkStack(app, 'MyStack');
