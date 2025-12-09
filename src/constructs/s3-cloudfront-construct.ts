import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  HttpVersion,
  KeyGroup,
  PriceClass,
  PublicKey,
  ResponseHeadersPolicy,
  S3OriginAccessControl,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AaaaRecord, ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Environment } from '@/lib/environment';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';

interface S3CloudfrontConstructProps {
  hostedZone: IHostedZone;
  globalCertificate: ICertificate;
}

export class S3CloudfrontConstruct extends Construct {
  public readonly bucket: Bucket;
  public readonly cloudFront: Distribution;
  // public readonly keyGroup: KeyGroup;

  constructor(
    scope: Construct,
    id: string,
    environment: Environment,
    props: S3CloudfrontConstructProps,
  ) {
    super(scope, id);

    // S3 버킷
    this.bucket = new Bucket(this, 'Bucket', {
      bucketName: `bucket-${environment.env}`, // 버킷 이름
      encryption: BucketEncryption.S3_MANAGED, // 암호화
      bucketKeyEnabled: true, // 버킷 키
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL, // 퍼블릭 액세스 차단
      versioned: false, // 버전 관리
      // CORS 설정
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
          allowedOrigins: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      // 수명 정책
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(7), // 7일 이상 지난 불완전한 멀티파트 업로드 삭제
        },
      ],
      removalPolicy:
        environment.env === 'production' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY, // 삭제 정책
    });

    // 원본 엑세스 제어
    const originAccessControl = new S3OriginAccessControl(this, 'BucketOriginAccessControl', {});

    // 원본
    const bucketOrigin = S3BucketOrigin.withOriginAccessControl(this.bucket, {
      originAccessControl,
    });

    // CORS 응답 헤더 정책
    const corsResponseHeadersPolicy = new ResponseHeadersPolicy(this, 'CorsResponseHeadersPolicy', {
      corsBehavior: {
        accessControlAllowCredentials: false, // Access-Control-Allow-Credentials
        accessControlAllowHeaders: ['*'], // Access-Control-Allow-Headers
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'], // Access-Control-Allow-Methods
        accessControlAllowOrigins: environment.corsAllowedOrigins, // Access-Control-Allow-Origin
        originOverride: true, // 오리진 재정의
        accessControlMaxAge: Duration.days(1), // Access-Control-Max-Age
      },
      securityHeadersBehavior: {
        // Content-Type-Options: nosniff
        contentTypeOptions: {
          override: true,
        },
        // Referrer-Policy
        referrerPolicy: {
          override: true,
          referrerPolicy: HeadersReferrerPolicy.ORIGIN_WHEN_CROSS_ORIGIN,
        },
        // Content-Security-Policy
        contentSecurityPolicy: {
          override: true,
          contentSecurityPolicy:
            "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; media-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';",
        },
        // Frame-Options: DENY
        frameOptions: {
          override: true,
          frameOption: HeadersFrameOption.DENY,
        },
      },
    });

    // NOTE: CloudFront Signed URL 사용 시 주석 해제
    // 퍼블릭 키
    // const publicKey = new PublicKey(this, 'PublicKey', {
    //   publicKeyName: `public-key-${environment.env}`,
    //   encodedKey: fs.readFileSync(path.join(__dirname, '../../keys/public-key.pem'), 'utf-8'), // 퍼블릭 키 파일
    // });

    // 키 그룹
    // this.keyGroup = new KeyGroup(this, 'KeyGroup', {
    //   keyGroupName: `key-group-${environment.env}`,
    //   items: [publicKey],
    // });

    // CloudFront
    this.cloudFront = new Distribution(this, 'CloudFront', {
      // 기본 Behavior (인증 없음)
      defaultBehavior: {
        origin: bucketOrigin, // 원본
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // HTTPS로 리다이렉트
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS, // GET, HEAD, OPTIONS 메서드 허용
        compress: true, // 압축 활성화
        cachePolicy: CachePolicy.CACHING_OPTIMIZED, // 캐시 정책 (S3 콘텐츠 타입에 따라 캐시 정책 자동 선택)
        responseHeadersPolicy: corsResponseHeadersPolicy, // 응답 헤더 정책 (CORS)
      },
      // private/* 경로용 추가 Behavior (Signed URL 필요)
      // additionalBehaviors: {
      //   'private/*': {
      //     origin: bucketOrigin, // 원본
      //     viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // HTTPS로 리다이렉트
      //     allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS, // GET, HEAD, OPTIONS 메서드 허용
      //     compress: true, // 압축 활성화
      //     cachePolicy: CachePolicy.CACHING_OPTIMIZED, // 캐시 정책 (S3 콘텐츠 타입에 따라 캐시 정책 자동 선택)
      //     responseHeadersPolicy: corsResponseHeadersPolicy, // 응답 헤더 정책 (CORS)
      //     trustedKeyGroups: [this.keyGroup], // Trusted Key Groups 설정
      //   },
      // },
      domainNames: [environment.cloudFrontDomain], // 도메인 이름
      certificate: props.globalCertificate, // us-east-1 ACM 인증서
      httpVersion: HttpVersion.HTTP2_AND_3, // HTTP/2 및 HTTP/3 허용
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021, // TLS 1.2 이상 허용
      priceClass: PriceClass.PRICE_CLASS_200, // 북미, 유럽, 아시아, 중동 및 아프리카
      enableIpv6: true, // IPv6 활성화
    });

    // A 레코드 추가
    new ARecord(this, 'CloudFrontARecord', {
      zone: props.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.cloudFront)),
      recordName: environment.cloudFrontDomain,
    });

    // AAAA 레코드 추가
    new AaaaRecord(this, 'CloudFrontAaaaRecord', {
      zone: props.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.cloudFront)),
      recordName: environment.cloudFrontDomain,
    });

    // 출력
    new CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'Bucket Name',
    });

    new CfnOutput(this, 'BucketArn', {
      value: this.bucket.bucketArn,
      description: 'Bucket ARN',
    });

    new CfnOutput(this, 'CloudFrontDistributionDomainName', {
      value: this.cloudFront.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new CfnOutput(this, 'CloudFrontDomainName', {
      value: environment.cloudFrontDomain,
      description: 'CloudFront Domain Name',
    });

    // new CfnOutput(this, 'KeyGroupId', {
    //   value: this.keyGroup.keyGroupId,
    //   description: 'Key Group ID',
    // });
  }
}
