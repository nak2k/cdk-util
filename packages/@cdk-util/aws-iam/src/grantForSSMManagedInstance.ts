import { IRole, ManagedPolicy } from '@aws-cdk/aws-iam';

/**
 * Grant connect to Systems Manager.
 *
 * @param role
 */
export function grantForSSMManagedInstance(role: IRole) {
  const managedPolicy = ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore');
  role.addManagedPolicy(managedPolicy);
}
