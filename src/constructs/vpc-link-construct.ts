import { CfnOutput } from 'aws-cdk-lib';
import { VpcLink } from 'aws-cdk-lib/aws-apigatewayv2';
import { type SecurityGroup, SubnetType, type Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface VpcLinkConstructProps {
  vpc: Vpc;
  vpcLinkSg: SecurityGroup;
}

export class VpcLinkConstruct extends Construct {
  public readonly vpcLink: VpcLink;

  constructor(scope: Construct, id: string, props: VpcLinkConstructProps) {
    super(scope, id);

    // VPC Link 생성
    this.vpcLink = new VpcLink(this, 'VpcLink', {
      vpc: props.vpc, // VPC
      subnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS }, // 서브넷
      securityGroups: [props.vpcLinkSg], // 보안 그룹
    });

    // 출력
    new CfnOutput(this, 'VpcLinkId', {
      value: this.vpcLink.vpcLinkId,
      description: 'VPC Link ID',
    });
  }
}
