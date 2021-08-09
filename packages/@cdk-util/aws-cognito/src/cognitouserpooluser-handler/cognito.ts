import { CognitoIdentityServiceProvider, SSM, SecretsManager } from 'aws-sdk';

const cognito = new CognitoIdentityServiceProvider();

export async function cognitoCreateUser(options: {
  UserPoolId: string;
  Username: string;
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
}) {
  const Password = await getPassword(options);

  const { UserPoolId, Username } = options;

  await cognito.adminCreateUser({
    UserPoolId,
    Username,
  }).promise();

  if (!Password) {
    return Username;
  }

  try {
    await cognito.adminSetUserPassword({
      UserPoolId,
      Username,
      Password,
      Permanent: true,
    }).promise();
  } catch (err) {
    await cognitoDeleteUser({
      UserPoolId,
      Username,
    }).finally(() => {
      // Rethrow the original exception regardless of whether the user deletion was successful or not.
      throw err;
    });
  }

  return Username;
}

async function getPassword(options: {
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
}): Promise<string | undefined> {
  const { PasswordLength, SecretId, PasswordParameterName } = options;

  if (SecretId) {
    return (await getSecret(SecretId)).password;
  } else if (PasswordParameterName) {
    const secretsmanager = new SecretsManager();

    const data = await secretsmanager.getRandomPassword({
      ExcludeCharacters: "+-=",
      PasswordLength,
    }).promise();

    const { RandomPassword } = data;
    if (!RandomPassword) {
      throw new Error(`secretsmanager.getRandomPassword() returns empty password`);
    }

    const ssm = new SSM();
    await ssm.putParameter({
      Name: PasswordParameterName,
      Value: RandomPassword,
      Overwrite: true,
    }).promise();

    return RandomPassword;
  } else {
    return;
  }
}

async function getSecret(secretId: string): Promise<{ password: string }> {
  const secretsmanager = new SecretsManager();

  const secretValue = await secretsmanager.getSecretValue({
    SecretId: secretId,
  }).promise();

  const { SecretString } = secretValue;
  if (!SecretString) {
    throw new Error(`The secret ${secretId} is empty`);
  }

  try {
    return JSON.parse(SecretString);
  } catch (err) {
    throw new Error(`The secret ${secretId} is invalid JSON: ${err.message}`);
  }
}

export async function cognitoDeleteUser(options: {
  UserPoolId: string;
  Username: string;
}) {
  try {
    await cognito.adminDeleteUser(options).promise();
  } catch (err) {
    // Ignore UserNotFoundException
    if (err.code === "UserNotFoundException") {
      return;
    }

    // Otherwise, rethrow.
    throw err;
  }
}
