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

    const s3pathParameters = integrationPath.match(/(?<=\{)[^}]+(?=\})/g) || [];
    for (const paramName of s3pathParameters) {
      if (!pathParameters.includes(paramName)) {
        throw new Error(`The path parameter "${paramName}" is not exists in the path "${path}"`);
      }
    }

    const requestParameters: { [dest: string]: string; } = {
      "integration.request.header.If-Match": "method.request.header.If-Match",
      "integration.request.header.If-Modified-Since": "method.request.header.If-Modified-Since",
      "integration.request.header.If-None-Match": "method.request.header.If-None-Match",
      "integration.request.header.If-Unmodified-Since": "method.request.header.If-Unmodified-Since",
      "integration.request.header.Range": "method.request.header.Range",
    };

    pathParameters.forEach(name =>
      requestParameters[`integration.request.path.${name}`] = `method.request.path.${name}`
    );

    const normalResponseParameters = {
      'method.response.header.Accept-Ranges': 'integration.response.header.Accept-Ranges',
      'method.response.header.Cache-Control': 'integration.response.header.Cache-Control',
      'method.response.header.Content-Disposition': 'integration.response.header.Content-Disposition',
      'method.response.header.Content-Encoding': 'integration.response.header.Content-Encoding',
      'method.response.header.Content-Language': 'integration.response.header.Content-Language',
      'method.response.header.Content-Range': 'integration.response.header.Content-Range',
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
      'method.response.header.ETag': 'integration.response.header.ETag',
      'method.response.header.Expires': 'integration.response.header.Expires',
      'method.response.header.Last-Modified': 'integration.response.header.Last-Modified',
    };

    const errorResponseParameters = {
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
    };

    return this.get(path, new AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: integrationPath,
      subdomain: bucket.bucketName,
      options: {
        credentialsRole,
        requestParameters,
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: normalResponseParameters,
          }, {
            statusCode: "206",
            selectionPattern: "206",
            responseParameters: normalResponseParameters,
          }, {
            statusCode: "304",
            selectionPattern: "304",
            responseParameters: normalResponseParameters,
          }, {
            statusCode: "400",
            selectionPattern: "4\\d{2}",
            responseParameters: errorResponseParameters,
          }, {
            statusCode: "500",
            selectionPattern: "5\\d{2}",
            responseParameters: errorResponseParameters,
          },
        ],
      },
    }), {
      ...methodOptions,
      requestParameters: RestApiBuilder.booleanMapForValue(requestParameters),
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: RestApiBuilder.booleanMapForKey(normalResponseParameters),
        }, {
          statusCode: "206",
          responseParameters: RestApiBuilder.booleanMapForKey(normalResponseParameters),
        }, {
          statusCode: "304",
          responseParameters: RestApiBuilder.booleanMapForKey(normalResponseParameters),
        }, {
          statusCode: "400",
          responseParameters: RestApiBuilder.booleanMapForKey(errorResponseParameters),
        }, {
          statusCode: "500",
          responseParameters: RestApiBuilder.booleanMapForKey(errorResponseParameters),
        },
      ],
    });
  }

  putS3Integration(path: string | readonly string[], props: S3IntegrationProps) {
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

    const s3pathParameters = integrationPath.match(/(?<=\{)[^}]+(?=\})/g) || [];
    for (const paramName of s3pathParameters) {
      if (!pathParameters.includes(paramName)) {
        throw new Error(`The path parameter "${paramName}" is not exists in the path "${path}"`);
      }
    }

    const requestParameters: { [dest: string]: string; } = {
      "integration.request.header.Cache-Control": "method.request.header.Cache-Control",
      "integration.request.header.Content-Disposition": "method.request.header.Content-Disposition",
      "integration.request.header.Content-Language": "method.request.header.Content-Language",
      "integration.request.header.Expires": "method.request.header.Expires",
    };

    pathParameters.forEach(name =>
      requestParameters[`integration.request.path.${name}`] = `method.request.path.${name}`
    );

    const normalResponseParameters = {
      'method.response.header.ETag': 'integration.response.header.ETag',
    };

    const errorResponseParameters = {
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
    };

    return this.put(path, new AwsIntegration({
      service: "s3",
      integrationHttpMethod: "PUT",
      path: integrationPath,
      subdomain: bucket.bucketName,
      options: {
        credentialsRole,
        requestParameters,
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: normalResponseParameters,
          }, {
            statusCode: "400",
            selectionPattern: "4\\d{2}",
            responseParameters: errorResponseParameters,
          }, {
            statusCode: "500",
            selectionPattern: "5\\d{2}",
            responseParameters: errorResponseParameters,
          },
        ],
      },
    }), {
      ...methodOptions,
      requestParameters: RestApiBuilder.booleanMapForValue(requestParameters),
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: RestApiBuilder.booleanMapForKey(normalResponseParameters),
        }, {
          statusCode: "400",
          responseParameters: RestApiBuilder.booleanMapForKey(errorResponseParameters),
        }, {
          statusCode: "500",
          responseParameters: RestApiBuilder.booleanMapForKey(errorResponseParameters),
        },
      ],
    });
  }

  private static booleanMapForKey(stringToStringMap: { [name: string]: string }): { [name: string]: boolean } {
    return Object.keys(stringToStringMap).reduce((result, key) => {
      result[key] = true;
      return result;
    }, {} as { [name: string]: boolean });
  }

  private static booleanMapForValue(stringToStringMap: { [name: string]: string }): { [name: string]: boolean } {
    return Object.values(stringToStringMap).reduce((result, key) => {
      result[key] = true;
      return result;
    }, {} as { [name: string]: boolean });
  }
}
