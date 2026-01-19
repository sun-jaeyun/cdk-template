import { Stack, StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { DatabaseConstruct } from '@/constructs/database-construct';
import { ServerlessCacheConstruct } from '@/constructs/serverless-cache-construct';
import { EcrConstruct } from '@/constructs/ecr-construct';
import { Route53Construct } from '@/constructs/route53-construct';
import { SecurityGroupConstruct } from '@/constructs/security-group-construct';
import { VpcLinkConstruct } from '@/constructs/vpc-link-construct';
import { VpcSubnetConstruct } from '@/constructs/vpc-subnet-construct';

export class FoundationStack extends Stack {
  public readonly route53Acm: Route53Construct;
  public readonly vpcSubnet: VpcSubnetConstruct;
  public readonly securityGroup: SecurityGroupConstruct;
  public readonly vpcLink: VpcLinkConstruct;
  public readonly database: DatabaseConstruct;
  public readonly cache: ServerlessCacheConstruct;
  public readonly ecr: EcrConstruct;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Route53 ACM 가져오기
    this.route53Acm = new Route53Construct(this, 'Route53AcmConstruct');

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

    // Database 생성
    this.database = new DatabaseConstruct(this, 'DatabaseConstruct', {
      vpc: this.vpcSubnet.vpc,
      databaseSg: this.securityGroup.databaseSg,
    });

    // Cache 생성
    this.cache = new ServerlessCacheConstruct(this, 'ServerlessCacheConstruct', {
      vpc: this.vpcSubnet.vpc,
      cacheSg: this.securityGroup.cacheSg,
    });

    // ECR 생성
    this.ecr = new EcrConstruct(this, 'EcrConstruct');
  }
}
