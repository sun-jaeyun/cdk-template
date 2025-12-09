import { Stack, StackProps } from 'aws-cdk-lib';

import { BackendApplicationConstruct } from '@/constructs/backend-application-construct';
import { EcsClusterConstruct } from '@/constructs/ecs-cluster-construct';
import { EventBridgeConstruct } from '@/constructs/eventbridge-construct';
import { FrontendApplicationConstruct } from '@/constructs/frontend-application-construct';
import { S3CloudfrontConstruct } from '@/constructs/s3-cloudfront-construct';
import { SqsConstruct } from '@/constructs/sqs-construct';

import { FoundationStack } from './foundation-stack';

import type { Environment } from '@/lib/environment';
import type { Construct } from 'constructs';

export class ApplicationStack extends Stack {
  public readonly s3Cloudfront: S3CloudfrontConstruct;
  public readonly sqs: SqsConstruct;
  public readonly ecsCluster: EcsClusterConstruct;

  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    environment: Environment,
    foundation: FoundationStack,
  ) {
    super(scope, id, props);

    // S3 CloudFront 생성
    this.s3Cloudfront = new S3CloudfrontConstruct(this, 'S3CloudfrontConstruct', environment, {
      hostedZone: foundation.route53Acm.hostedZone,
      globalCertificate: foundation.route53Acm.globalCertificate,
    });

    // SQS 생성
    this.sqs = new SqsConstruct(this, 'SqsConstruct', environment);

    // ECS 클러스터 생성
    this.ecsCluster = new EcsClusterConstruct(this, 'EcsClusterConstruct', environment, {
      vpc: foundation.vpcSubnet.vpc,
    });

    // EventBridge 생성
    new EventBridgeConstruct(this, 'EventBridgeConstruct', environment, {
      queue: this.sqs.queue,
    });

    // Backend 애플리케이션 생성
    new BackendApplicationConstruct(this, 'BackendApplicationConstruct', environment, {
      vpc: foundation.vpcSubnet.vpc,
      sg: foundation.securityGroup.backendSg,
      lbSg: foundation.securityGroup.backendLbSg,
      cluster: this.ecsCluster.cluster,
      repository: foundation.ecr.backendRepository,
      vpcLink: foundation.vpcLink.vpcLink,
      hostedZone: foundation.route53Acm.hostedZone,
      privateHostedZone: foundation.route53Acm.privateHostedZone,
      certificate: foundation.route53Acm.certificate,
    });

    // Frontend 애플리케이션 생성
    new FrontendApplicationConstruct(this, 'FrontendApplicationConstruct', environment, {
      vpc: foundation.vpcSubnet.vpc,
      sg: foundation.securityGroup.frontendSg,
      lbSg: foundation.securityGroup.frontendLbSg,
      cluster: this.ecsCluster.cluster,
      repository: foundation.ecr.frontendRepository,
      hostedZone: foundation.route53Acm.hostedZone,
      certificate: foundation.route53Acm.certificate,
    });
  }
}
