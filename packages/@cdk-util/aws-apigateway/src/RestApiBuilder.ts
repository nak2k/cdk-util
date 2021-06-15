import { RestApi, Integration, MethodOptions, AwsIntegration } from "@aws-cdk/aws-apigateway";
import { IRole } from "@aws-cdk/aws-iam";
import { IBucket } from '@aws-cdk/aws-s3';

type HttpMethod = 'HEAD' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'ANY';

export interface RestApiBuilderProps {
  restApi: RestApi;
  defaultRole?: IRole;
}

export type S3IntegrationProps = {
  bucket: IBucket;
  path?: string;
  role?: IRole;
} & Omit<MethodOptions, "requestParameters" | "methodResponses">;

export class RestApiBuilder {
  private readonly restApi: RestApi;
  private readonly defaultRole?: IRole;

  constructor(props: RestApiBuilderProps) {
    this.restApi = props.restApi;
    this.defaultRole = props.defaultRole;
  }

  addRoute(path: string | readonly string[], method: HttpMethod, target?: Integration, options?: MethodOptions) {
    if (typeof path !== 'string') {
      path.forEach(path => this.addRoute(path, method, target, options));
      return;
    }

    this.restApi.root.resourceForPath(path).addMethod(method, target, options);
  }

  head(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "HEAD", target, options);
    return this;
  }

  get(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "GET", target, options);
    return this;
  }

  post(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "POST", target, options);
    return this;
  }

  put(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "PUT", target, options);
    return this;
  }

  delete(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "DELETE", target, options);
    return this;
  }

  patch(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "PATCH", target, options);
    return this;
  }

  options(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "OPTIONS", target, options);
    return this;
  }

  any(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "ANY", target, options);
    return this;
  }

  getS3Integration(path: string | readonly string[], props: S3IntegrationProps) {
    if (typeof path !== 'string') {
      path.forEach(path => this.getS3Integration(path, props));
      return this;
    }

    if (path.match(/\+}/)) {
      throw new Error(`The greedy path ${path} can not be specified in the S3 intergration`);
    }

    const {
      bucket,
      path: integrationPath = path,
      role: credentialsRole = this.defaultRole,
      ...methodOptions
    } = props;

    if (!credentialsRole) {
      throw new Error("The role must be specified in the S3 intergration");
    }

    const pathParameters = path.match(/(?<=\{)[^}]+(?=\})/g) || [];

    if (integrationPath !== path) {
      const s3pathParameters = integrationPath.match(/(?<=\{)[^}]+(?=\})/g) || [];

      for (const paramName of s3pathParameters) {
        if (!pathParameters.includes(paramName)) {
          throw new Error(`The path parameter "${paramName}" is not exists in the path "${path}"`);
        }
      }
    }

    return this.get(path, new AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: integrationPath,
      subdomain: bucket.bucketName,
      options: {
        credentialsRole,
        requestParameters: pathParameters.reduce((result, name) => {
          result[`integration.request.path.${name}`] = `method.request.path.${name}`;
          return result;
        }, {} as { [dest: string]: string }),
        integrationResponses: [{
          statusCode: "200",
          responseParameters: {
            'method.response.header.Accept-Ranges': 'integration.response.header.Accept-Ranges',
            'method.response.header.Cache-Control': 'integration.response.header.Cache-Control',
            'method.response.header.Content-Disposition': 'integration.response.header.Content-Disposition',
            'method.response.header.Content-Encoding': 'integration.response.header.Content-Encoding',
            'method.response.header.Content-Language': 'integration.response.header.Content-Language',
            'method.response.header.Content-Length': 'integration.response.header.Content-Length',
            'method.response.header.Content-Range': 'integration.response.header.Content-Range',
            'method.response.header.Content-Type': 'integration.response.header.Content-Type',
            'method.response.header.Date': 'integration.response.header.Date',
            'method.response.header.ETag': 'integration.response.header.ETag',
            'method.response.header.Expires': 'integration.response.header.Expires',
            'method.response.header.Last-Modified': 'integration.response.header.Last-Modified',
          },
        }, {
          statusCode: "400",
          selectionPattern: "4\\d{2}",
          responseParameters: {
            'method.response.header.Content-Length': 'integration.response.header.Content-Length',
            'method.response.header.Content-Type': 'integration.response.header.Content-Type',
          },
        }, {
          statusCode: "500",
          selectionPattern: "5\\d{2}",
          responseParameters: {
            'method.response.header.Content-Length': 'integration.response.header.Content-Length',
            'method.response.header.Content-Type': 'integration.response.header.Content-Type',
          },
        }],
      },
    }), {
      ...methodOptions,
      requestParameters: pathParameters.reduce((result, name) => {
        result[`method.request.path.${name}`] = true;
        return result;
      }, {} as { [param: string]: true }),
      methodResponses: [{
        statusCode: "200",
        responseParameters: {
          'method.response.header.Accept-Ranges': true,
          'method.response.header.Cache-Control': true,
          'method.response.header.Content-Disposition': true,
          'method.response.header.Content-Encoding': true,
          'method.response.header.Content-Language': true,
          'method.response.header.Content-Length': true,
          'method.response.header.Content-Range': true,
          'method.response.header.Content-Type': true,
          'method.response.header.Date': true,
          'method.response.header.ETag': true,
          'method.response.header.Expires': true,
          'method.response.header.Last-Modified': true,
        },
      }, {
        statusCode: "400",
        responseParameters: {
          'method.response.header.Content-Length': true,
          'method.response.header.Content-Type': true,
        },
      }, {
        statusCode: "500",
        responseParameters: {
          'method.response.header.Content-Length': true,
          'method.response.header.Content-Type': true,
        },
      }],
    });
  }
}
