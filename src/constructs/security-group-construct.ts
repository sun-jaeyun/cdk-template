import { Peer, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface SecurityGroupConstructProps {
  vpc: Vpc;
}

export class SecurityGroupConstruct extends Construct {
  public readonly bastionSg: SecurityGroup;
  public readonly vpcLinkSg: SecurityGroup;
  public readonly frontendLbSg: SecurityGroup;
  public readonly frontendSg: SecurityGroup;
  public readonly backendLbSg: SecurityGroup;
  public readonly backendSg: SecurityGroup;
  public readonly databaseSg: SecurityGroup;
  public readonly cacheSg: SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupConstructProps) {
    super(scope, id);

    // Bastion 보안 그룹
    this.bastionSg = new SecurityGroup(this, 'BastionSg', {
      vpc: props.vpc,
      securityGroupName: 'bastion-sg',
      description: 'Bastion',
    });
    // 내 IP 추가
    this.bastionSg.addIngressRule(
      // TODO: 실제 값 추가
      Peer.ipv4('0.0.0.0/0' as const),
      Port.tcp(22),
      'My Ip',
    );

    // VPC Link 보안 그룹
    this.vpcLinkSg = new SecurityGroup(this, 'VpcLinkSg', {
      vpc: props.vpc,
      securityGroupName: 'vpc-link-sg',
      description: 'VPC Link',
    });

    // Frontend 로드밸런서 보안 그룹
    this.frontendLbSg = new SecurityGroup(this, 'FrontendLbSg', {
      vpc: props.vpc,
      securityGroupName: 'frontend-lb-sg',
      description: 'Frontend LoadBalancer',
    });
    // 80(HTTP), 443(HTTPS), 8080(블루/그린 배포 용) 포트 추가
    this.frontendLbSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow from anyone on port 80');
    this.frontendLbSg.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      'Allow from anyone on port 443',
    );
    this.frontendLbSg.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(8080),
      'Allow from anyone on port 8080',
    );

    // Frontend 보안그룹
    this.frontendSg = new SecurityGroup(this, 'FrontendSg', {
      vpc: props.vpc,
      securityGroupName: 'frontend-sg',
      description: 'Frontend',
    });
    // Frontend 로드밸런서 3000 포트 추가
    this.frontendSg.addIngressRule(this.frontendLbSg, Port.tcp(3000), 'Frontend LoadBalancer');

    // Backend 로드밸런서 보안그룹
    this.backendLbSg = new SecurityGroup(this, 'BackendLbSg', {
      vpc: props.vpc,
      securityGroupName: 'backend-lb-sg',
      description: 'Backend LoadBalancer',
    });
    // 80(HTTP), 8080(블루/그린 배포 용) 포트 추가
    this.backendLbSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow from anyone on port 80');
    this.backendLbSg.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(8080),
      'Allow from anyone on port 8080',
    );

    // Backend 보안그룹
    this.backendSg = new SecurityGroup(this, 'BackendSg', {
      vpc: props.vpc,
      securityGroupName: 'backend-sg',
      description: 'Backend',
    });
    // Backend 로드밸런서 3000 포트 추가
    this.backendSg.addIngressRule(this.backendLbSg, Port.tcp(3000), 'Load balancer to target');

    // 데이터베이스 보안그룹
    this.databaseSg = new SecurityGroup(this, 'DatabaseSg', {
      vpc: props.vpc,
      securityGroupName: 'database-sg',
      description: 'Database',
    });
    // Bastion, Backend 5432 포트 추가
    this.databaseSg.addIngressRule(this.bastionSg, Port.tcp(5432), 'Bastion');
    this.databaseSg.addIngressRule(this.backendSg, Port.tcp(5432), 'Backend');

    // Cache 보안그룹
    this.cacheSg = new SecurityGroup(this, 'CacheSg', {
      vpc: props.vpc,
      securityGroupName: 'cache-sg',
      description: 'Cache',
    });
    // Backend 6379 포트 추가
    this.cacheSg.addIngressRule(this.backendSg, Port.tcp(6379), 'Backend');
  }
}
