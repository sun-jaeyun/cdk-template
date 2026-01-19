import { CfnOutput } from 'aws-cdk-lib';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnServerlessCache } from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

interface ServerlessCacheConstructProps {
  vpc: Vpc;
  cacheSg: SecurityGroup;
}

export class ServerlessCacheConstruct extends Construct {
  public readonly cache: CfnServerlessCache;

  constructor(scope: Construct, id: string, props: ServerlessCacheConstructProps) {
    super(scope, id);

    // ElastiCache
    this.cache = new CfnServerlessCache(this, 'Cache', {
      serverlessCacheName: 'valkey-cache',
      engine: 'valkey', // 엔진
      majorEngineVersion: '8', // 버전
      subnetIds: props.vpc.isolatedSubnets.map((subnet) => subnet.subnetId), // 서브넷
      securityGroupIds: [props.cacheSg.securityGroupId], // 보안그룹
      snapshotRetentionLimit: 1, // 스냅샷 보존 기간 (일)
    });

    // 출력
    new CfnOutput(this, 'CacheArn', {
      value: this.cache.attrArn,
      description: 'Cache ARN',
    });

    new CfnOutput(this, 'CacheHost', {
      value: this.cache.attrEndpointAddress,
      description: 'Cache Host',
    });

    new CfnOutput(this, 'CachePort', {
      value: this.cache.attrEndpointPort,
      description: 'Cache Port',
    });
  }
}
