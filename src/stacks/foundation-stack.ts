import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { DatabaseCacheConstruct } from '@/constructs/database-cache-construct';
import { EcrConstruct } from '@/constructs/ecr-construct';
import { Route53AcmConstruct } from '@/constructs/route53-acm-construct';
import { SecurityGroupConstruct } from '@/constructs/security-group-construct';
import { VpcLinkConstruct } from '@/constructs/vpc-link-construct';
import { VpcSubnetConstruct } from '@/constructs/vpc-subnet-construct';

export class FoundationStack extends Stack {
  public readonly route53Acm: Route53AcmConstruct;
  public readonly vpcSubnet: VpcSubnetConstruct;
  public readonly securityGroup: SecurityGroupConstruct;
  public readonly vpcLink: VpcLinkConstruct;
  public readonly databaseCache: DatabaseCacheConstruct;
  public readonly ecr: EcrConstruct;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Route53 ACM 가져오기
    this.route53Acm = new Route53AcmConstruct(this, 'Route53AcmConstruct');

    // VPC 생성
    this.vpcSubnet = new VpcSubnetConstruct(this, 'VpcSubnetConstruct');

    // 보안 그룹 생성
    this.securityGroup = new SecurityGroupConstruct(this, 'SecurityGroupConstruct', {
      vpc: this.vpcSubnet.vpc,
    });

    // VPC Link 생성
    this.vpcLink = new VpcLinkConstruct(this, 'VpcLinkConstruct', {
      vpc: this.vpcSubnet.vpc,
      vpcLinkSg: this.securityGroup.vpcLinkSg,
    });

    // Database, Cache 생성
    this.databaseCache = new DatabaseCacheConstruct(this, 'DatabaseCacheConstruct', {
      vpc: this.vpcSubnet.vpc,
      databaseSg: this.securityGroup.databaseSg,
      cacheSg: this.securityGroup.cacheSg,
    });

    // ECR 생성
    this.ecr = new EcrConstruct(this, 'EcrConstruct');
  }
}
