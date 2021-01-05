import { ManagedPolicy, CfnRole, CfnUser } from '@aws-cdk/aws-iam';
import { IAspect, IConstruct, Stack } from '@aws-cdk/core';

export class PermissionsBoundaryAspect implements IAspect {
  private managedPolicyId = 'permissionsBoundaryPolicy';

  constructor(private managedPolicyName: string) {
  }

  visit(node: IConstruct): void {
    if (node instanceof CfnRole || node instanceof CfnUser) {
      node.permissionsBoundary = this.getPolicy(node).managedPolicyArn;
    }
  }

  private getPolicy(construct: IConstruct) {
    const stack = Stack.of(construct);

    const policy = stack.node.tryFindChild(this.managedPolicyId);

    if (!policy) {
      return ManagedPolicy.fromManagedPolicyName(stack, this.managedPolicyId, this.managedPolicyName);
    }

    if ('managedPolicyArn' in policy) {
      return policy;
    }

    throw new Error(`Construct ${this.managedPolicyId} must be an IManagedPolicy`);
  }
}
