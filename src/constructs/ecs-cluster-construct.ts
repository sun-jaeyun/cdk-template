import { CfnOutput } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

import type { Environment } from '@/lib/environment';

interface EcsClusterConstructProps {
  vpc: Vpc;
}

export class EcsClusterConstruct extends Construct {
  public readonly cluster: Cluster;

  constructor(
    scope: Construct,
    id: string,
    environment: Environment,
    props: EcsClusterConstructProps,
  ) {
    super(scope, id);

    // ECS 클러스터
    this.cluster = new Cluster(this, 'Cluster', {
      clusterName: `cluster-${environment.env}`, // 클러스터 이름
      vpc: props.vpc, // VPC
      enableFargateCapacityProviders: true, // Fargate 용량 공급자 활성화
    });

    new CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
    });
  }
}
