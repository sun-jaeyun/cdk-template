import { Certificate, type ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export class Route53AcmConstruct extends Construct {
  public readonly hostedZone: IHostedZone;
  public readonly campusHostedZone: IHostedZone;
  public readonly privateHostedZone: IHostedZone;
  public readonly globalCertificate: ICertificate;
  public readonly certificate: ICertificate;
  public readonly campusCertificate: ICertificate;

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

    // Global(us-east-1) ACM 인증서
    this.globalCertificate = Certificate.fromCertificateArn(
      this,
      'GlobalCertificate',
      // TODO: 실제 값 추가
      'arn:aws:acm:us-east-1:1234567890:certificate/' as const,
    );

    // ACM 인증서
    this.certificate = Certificate.fromCertificateArn(
      this,
      'Certificate',
      // TODO: 실제 값 추가
      'arn:aws:acm:ap-northeast-2:1234567890:certificate/' as const,
    );
  }
}
