import { Certificate, type ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export class AcmConstruct extends Construct {
  public readonly globalCertificate: ICertificate;
  public readonly apne2Certificate: ICertificate;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Global(us-east-1) ACM 인증서
    this.globalCertificate = Certificate.fromCertificateArn(
      this,
      'GlobalCertificate',
      // TODO: 실제 값 추가
      'arn:aws:acm:us-east-1:1234567890:certificate/' as const,
    );

    // ap-northeast-2 ACM 인증서
    this.apne2Certificate = Certificate.fromCertificateArn(
      this,
      'ApNortheast2Certificate',
      // TODO: 실제 값 추가
      'arn:aws:acm:ap-northeast-2:1234567890:certificate/' as const,
    );
  }
}
