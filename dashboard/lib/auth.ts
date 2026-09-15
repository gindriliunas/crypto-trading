import {
  AdminConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "paper_id_token";

export type AuthUser = {
  sub: string;
  email: string;
};

function region(): string {
  return process.env.AWS_REGION || process.env.COGNITO_REGION || "eu-west-2";
}

function userPoolId(): string {
  const value = process.env.COGNITO_USER_POOL_ID;
  if (!value) throw new Error("COGNITO_USER_POOL_ID is not configured");
  return value;
}

function clientId(): string {
  const value = process.env.COGNITO_CLIENT_ID;
  if (!value) throw new Error("COGNITO_CLIENT_ID is not configured");
  return value;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID,
  );
}

function cognitoClient() {
  return new CognitoIdentityProviderClient({ region: region() });
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  if (!jwks) {
    const url = new URL(
      `https://cognito-idp.${region()}.amazonaws.com/${userPoolId()}/.well-known/jwks.json`,
    );
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

export async function signUp(email: string, password: string) {
  const client = cognitoClient();

  await client.send(
    new SignUpCommand({
      ClientId: clientId(),
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    }),
  );

  // Confirm without a PreSignUp Lambda (CI IAM cannot create Lambda).
  await client.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: userPoolId(),
      Username: email,
    }),
  );

  await client.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId(),
      Username: email,
      UserAttributes: [{ Name: "email_verified", Value: "true" }],
    }),
  );
}

export async function signIn(email: string, password: string) {
  const response = await cognitoClient().send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId(),
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  );

  const idToken = response.AuthenticationResult?.IdToken;
  if (!idToken) {
    throw new Error("Login failed");
  }

  return idToken;
}

export async function verifyIdToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `https://cognito-idp.${region()}.amazonaws.com/${userPoolId()}`,
  });

  if (payload.token_use !== "id") {
    throw new Error("Invalid token use");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!sub || !email) {
    throw new Error("Token missing user claims");
  }

  return { sub, email };
}

export async function getSessionUser(): Promise<AuthUser | null> {
  if (!isAuthConfigured()) return null;

  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifyIdToken(token);
  } catch {
    return null;
  }
}

export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // App Runner serves HTTPS; AUTH_COOKIE_SECURE=true is set in Terraform
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
