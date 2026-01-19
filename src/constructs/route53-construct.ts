import { HostedZone, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export class Route53Construct extends Construct {
  public readonly hostedZone: IHostedZone;
  public readonly privateHostedZone: IHostedZone;


  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Route53 호스팅 영역
    this.hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
      // TODO: 실제 값 추가
      domainName: 'example.com' as const,
    });

    // Route53 프라이빗 호스팅 영역
    this.privateHostedZone = HostedZone.fromLookup(this, 'PrivateHostedZone', {
      // TODO: 실제 값 추가
      domainName: 'example.internal' as const,
      privateZone: true,
    });
  }
}
