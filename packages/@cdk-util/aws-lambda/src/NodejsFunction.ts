import { Code, Function, FunctionBase, FunctionProps, Runtime } from '@aws-cdk/aws-lambda';
import type { IPrincipal, IRole } from '@aws-cdk/aws-iam';
import { Construct, ConstructNode } from '@aws-cdk/core';
import { NodejsLayerVersion, NodejsLayerVersionProps } from './NodejsLayerVersion';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface NodejsFunctionProps extends Partial<FunctionProps>, Omit<NodejsLayerVersionProps, 'providerOnly'> {
}

export class NodejsFunction extends FunctionBase {
  readonly handler: Function;
  readonly nodejsLayerVersion: NodejsLayerVersion;

  get layerVersion() {
    return this.nodejsLayerVersion.layerVersion;
  }

  readonly grantPrincipal: IPrincipal;
  readonly functionName: string;
  readonly functionArn: string;
  readonly role?: IRole;
  readonly permissionsNode: ConstructNode;
  protected readonly canCreatePermissions: boolean;

  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    super(scope, id);

    const {
      packageDirectory,
      useLockFile,
      npmArgs,
      code,
      runtime,
      handler,
      layers,
      ...restProps
    } = props;

    this.nodejsLayerVersion = new NodejsLayerVersion(this, 'LayerVersion', {
      packageDirectory,
      useLockFile,
      npmArgs,
    });

    this.handler = new Function(this, 'Function', {
      code: code || NodejsFunction.getCode(packageDirectory),
      runtime: runtime || Runtime.NODEJS_14_X,
      handler: handler || 'index.handler',
      layers: layers ? [...layers, this.layerVersion] : [this.layerVersion],
      ...restProps
    });

    this.grantPrincipal = this.handler.grantPrincipal;
    this.functionName = this.handler.functionName;
    this.functionArn = this.handler.functionArn;
    this.role = this.handler.role;
    this.permissionsNode = this.handler.permissionsNode;
    this.canCreatePermissions = true;
  }

  public static getCode(packageDirectory: string) {
    const pkg = readFileSync(join(packageDirectory, 'package.json'), 'utf8');
    const { main } = JSON.parse(pkg);

    return Code.fromAsset(main ? join(packageDirectory, main) : packageDirectory);
  }
}
