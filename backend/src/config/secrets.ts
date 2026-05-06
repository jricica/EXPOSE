import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export async function loadSecrets() {
  const secret_name = "rds!db-6d43d572-59ab-4b93-8e64-f5b5bef69f46";
  
  // Si no hay credenciales, saltará un error al instanciar o enviar.
  // Es importante tener AWS_REGION, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en el ambiente local, 
  // o permisos de IAM si se corre en AWS.
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || "us-east-2",
  });

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT",
      })
    );

    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      
      if (secret.host) process.env.DB_HOST = secret.host;
      if (secret.username) process.env.DB_USER = secret.username;
      if (secret.password) process.env.DB_PASSWORD = secret.password;
      if (secret.port) process.env.DB_PORT = secret.port.toString();
      
      const host = process.env.DB_HOST;
      const user = process.env.DB_USER;
      const pass = encodeURIComponent(process.env.DB_PASSWORD || "");
      const dbname = process.env.DB_NAME || "expose"; // La BD se llama expose
      const port = process.env.DB_PORT || "3306";

      // Reconstruimos el DATABASE_URL para Prisma
      process.env.DATABASE_URL = `mysql://${user}:${pass}@${host}:${port}/${dbname}`;
      
      console.log("✅ Secretos cargados exitosamente desde AWS Secrets Manager.");
    }
  } catch (error) {
    console.error("❌ Falló la obtención de secretos desde AWS:", error);
    // No lanzamos el error para que use las credenciales locales si las hubiera.
  }
}
