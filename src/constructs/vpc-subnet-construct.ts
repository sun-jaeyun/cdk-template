import {
  CfnNatGateway,
  GatewayVpcEndpointAwsService,
  IpAddresses,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcSubnetConstruct extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // VPC 생성
    this.vpc = new Vpc(this, 'Vpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'), // IP 대역
      maxAzs: 3, // 최대 가용 영역 수
      // NOTE: Regional NAT Gateway 사용 시 1개만
      natGateways: 1, // NAT 게이트웨이 수
      subnetConfiguration: [
        { cidrMask: 20, name: 'subnet-public', subnetType: SubnetType.PUBLIC }, // 퍼블릭 서브넷
        { cidrMask: 20, name: 'subnet-private', subnetType: SubnetType.PRIVATE_WITH_EGRESS }, // 프라이빗 서브넷
        { cidrMask: 20, name: 'subnet-isolated', subnetType: SubnetType.PRIVATE_ISOLATED }, // 격리된 프라이빗 서브넷
      ],
    });

    // NOTE: CDK에서 Regional NAT Gateway 지원 전까지 아래 주석 해제하여 사용
    // this.vpc.node.findAll().forEach((child) => {
    //   if (child instanceof CfnNatGateway) {
    //     child.addPropertyOverride('AvailabilityMode', 'regional');
    //     child.addPropertyOverride('VpcId', this.vpc.vpcId);
    //     child.addPropertyDeletionOverride('SubnetId');
    //   }
    // });

    // S3 게이트웨이 엔드포인트
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
    });

    // DynamoDB 게이트웨이 엔드포인트
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: GatewayVpcEndpointAwsService.DYNAMODB,
    });
  }
}
