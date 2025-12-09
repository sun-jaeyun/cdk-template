// 환경
export type Env = 'staging' | 'production';

// CPU
export type Cpu = 256 | 512 | 1024 | 2048 | 4096 | 8192;

// Memory
export type Memory = 512 | 1024 | 2048 | 4096 | 8192 | 16384;

// 공통 환경 변수
export type SharedEnvironment = {
  corsAllowedOrigins: string[]; // CORS 허용 도메인
  envBucketArn: string; // 환경 변수 버킷 ARN
};

// 가변 환경 변수
export type VariableEnvironment = {
  env: Env; // 환경
  cloudFrontDomain: string; // CloudFront 도메인
  containerName: string; // 컨테이너 이름
  containerPort: number; // 컨테이너 포트
  backendCpu: Cpu; // Backend CPU
  backendMemory: Memory; // Backend 메모리
  backendEnvPath: string; // Backend 환경 변수 경로
  backendDesiredCount: number; // Backend 원하는 태스크 수
  backendDomain: string; // Backend 도메인
  apiGatewayDomain: string; // API Gateway 도메인
  frontendCpu: Cpu; // Frontend  CPU
  frontendMemory: Memory; // Frontend  메모리
  frontendEnvPath: string; // Frontend  환경 변수 경로
  frontendDesiredCount: number; // Frontend  원하는 태스크 수
  frontendDomain: string; // Frontend  도메인
};

// 공통 & 가변 환경 변수
export type Environment = SharedEnvironment & VariableEnvironment;

// 공통 환경 변수 선언
export const sharedEnvironment: SharedEnvironment = {
  // TODO: 실제 값 추가
  corsAllowedOrigins: ['example.com', '*.example.com'],
  // TODO: 실제 값 추가
  envBucketArn: 'arn:aws:s3:::example-env',
} as const;

// 스테이징 환경 변수
export const stagingEnvironment: Environment = {
  ...sharedEnvironment,
  env: 'staging',
  // TODO: 실제 값 추가
  cloudFrontDomain: 'staging-cdn.example.com',
  containerName: 'app',
  containerPort: 3000,
  backendCpu: 256,
  backendMemory: 512,
  // TODO: 실제 값 추가
  backendEnvPath: 'backend/staging/.env',
  backendDesiredCount: 1,
  // TODO: 실제 값 추가
  backendDomain: 'staging-api.example.internal',
  // TODO: 실제 값 추가
  apiGatewayDomain: 'staging-api.example.com',
  frontendCpu: 256,
  frontendMemory: 512,
  // TODO: 실제 값 추가
  frontendEnvPath: 'frontend/staging/.env',
  frontendDesiredCount: 1,
  // TODO: 실제 값 추가
  frontendDomain: 'staging.example.com',
} as const;

// 프로덕션 환경 변수
export const productionEnvironment: Environment = {
  ...sharedEnvironment,
  env: 'production',
  // TODO: 실제 값 추가
  cloudFrontDomain: 'cdn.example.com',
  containerName: 'app',
  containerPort: 3000,
  backendCpu: 512,
  backendMemory: 1024,
  // TODO: 실제 값 추가
  backendEnvPath: 'backend/production/.env',
  backendDesiredCount: 1,
  // TODO: 실제 값 추가
  backendDomain: 'api.example.internal',
  // TODO: 실제 값 추가
  apiGatewayDomain: 'api.example.com',
  frontendCpu: 512,
  frontendMemory: 1024,
  // TODO: 실제 값 추가
  frontendEnvPath: 'frontend/production/.env',
  frontendDesiredCount: 1,
  // TODO: 실제 값 추가
  frontendDomain: 'example.com',
};
