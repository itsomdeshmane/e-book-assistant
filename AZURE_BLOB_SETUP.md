# Azure Blob Storage Setup Guide

This guide walks you through setting up Azure Blob Storage for the E-Book Assistant application to store uploaded PDF files.

## Prerequisites

- An active Azure subscription ([create one for free](https://azure.microsoft.com/free/))
- Access to the Azure Portal

## Step 1: Create a Storage Account

1. **Navigate to Azure Portal**
   - Go to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure credentials

2. **Create Storage Account**
   - Click on **"Create a resource"** (+ icon in the top left)
   - Search for **"Storage account"** and select it
   - Click **"Create"**

3. **Configure Basic Settings**
   - **Subscription**: Select your Azure subscription
   - **Resource Group**: Create new or select existing (e.g., `ebook-assistant-rg`)
   - **Storage account name**: Choose a unique name (e.g., `ebookassistantstorage`)
     - Must be 3-24 characters, lowercase letters and numbers only
     - Must be globally unique across all Azure storage accounts
   - **Region**: Choose a region close to your application deployment (e.g., `East US`)
   - **Performance**: Select **Standard** (sufficient for most use cases)
   - **Redundancy**: Select **Locally-redundant storage (LRS)** for cost efficiency
     - For production, consider **Geo-redundant storage (GRS)** for higher availability

4. **Advanced Settings** (optional, use defaults for quick setup)
   - Leave default settings unless you have specific requirements
   - **Secure transfer required**: Keep enabled (HTTPS only)
   - **Blob public access**: Keep disabled for security

5. **Review and Create**
   - Click **"Review + create"**
   - Verify the settings
   - Click **"Create"**
   - Wait for deployment to complete (usually takes 1-2 minutes)

## Step 2: Create a Blob Container

1. **Navigate to Your Storage Account**
   - After deployment, click **"Go to resource"**
   - Or search for your storage account name in the Azure Portal search bar

2. **Access Containers**
   - In the left sidebar, under **Data storage**, click **"Containers"**

3. **Create New Container**
   - Click **"+ Container"** at the top
   - **Name**: Enter `pdf-uploads` (or your preferred name)
     - Container names must be lowercase
     - Can contain letters, numbers, and hyphens
   - **Public access level**: Select **Private (no anonymous access)**
   - Click **"Create"**

## Step 3: Get Your Connection String

1. **Navigate to Access Keys**
   - In your storage account, go to **Security + networking** → **Access keys** in the left sidebar

2. **Copy Connection String**
   - You'll see two keys (key1 and key2)
   - Click **"Show"** next to "Connection string" under **key1**
   - Click the **copy icon** to copy the entire connection string
   - It will look like:
     ```
     DefaultEndpointsProtocol=https;AccountName=yourstoragename;AccountKey=your-long-key-here==;EndpointSuffix=core.windows.net
     ```

   > **Security Note**: Keep this connection string secure! It provides full access to your storage account.

## Step 4: Configure Your Application

1. **Create or Update .env File**
   
   In your project root directory, create or update your `.env` file with the following:

   ```env
   # Azure Blob Storage Configuration
   AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=yourstoragename;AccountKey=your-key-here==;EndpointSuffix=core.windows.net"
   AZURE_STORAGE_CONTAINER_NAME="pdf-uploads"
   ```

   Replace the connection string with the one you copied from Azure Portal.

2. **Verify Other Required Environment Variables**
   
   Ensure your `.env` file also contains:
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY="your-openai-api-key"
   
   # Pinecone Configuration
   PINECONE_API_KEY="your-pinecone-api-key"
   PINECONE_INDEX_NAME="your-index-name"
   
   # Azure Document Intelligence (for OCR)
   AZURE_DI_ENDPOINT="https://your-resource.cognitiveservices.azure.com"
   AZURE_DI_KEY="your-azure-di-key"
   
   # JWT Configuration
   JWT_SECRET="your-secret-key"
   ```

## Step 5: Install Dependencies

If you haven't already, install the Azure Blob Storage SDK:

```bash
pip install -r requirements.txt
```

Or specifically:
```bash
pip install azure-storage-blob>=12.19.0
```

## Step 6: Test the Connection

You can test your Azure Blob Storage connection by running the application and uploading a test PDF:

```bash
# Activate your virtual environment
.\venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

# Run the application
uvicorn app.main:app --reload
```

Then navigate to `http://localhost:8000/docs` and test the `/documents/upload` endpoint.

## Troubleshooting

### Connection String Issues

**Error**: `ValueError: AZURE_STORAGE_CONNECTION_STRING environment variable is required`

**Solution**: Make sure your `.env` file is in the project root and contains the connection string without quotes or extra spaces.

---

**Error**: `Server failed to authenticate the request`

**Solution**: 
- Verify your connection string is correct
- Make sure you copied the entire connection string including the `EndpointSuffix`
- Check that your storage account access keys haven't been regenerated

### Container Issues

**Error**: `The specified container does not exist`

**Solution**: 
- Ensure the container name in your `.env` matches the container name in Azure Portal
- Container names are case-sensitive and must be lowercase
- The application will attempt to create the container automatically if it doesn't exist

### Network Issues

**Error**: `Connection timeout` or `Unable to reach storage account`

**Solution**:
- Check your internet connection
- Verify firewall settings allow outbound HTTPS connections
- If using a corporate network, check proxy settings

## Cost Considerations

Azure Blob Storage pricing is based on:
- **Storage capacity**: Pay per GB stored per month
- **Transactions**: Pay per API operation (uploads, downloads, deletes)
- **Data transfer**: Outbound data transfer charges

For the free tier and pricing details, visit: [Azure Blob Storage Pricing](https://azure.microsoft.com/pricing/details/storage/blobs/)

### Cost Optimization Tips

1. Use **LRS (Locally-redundant storage)** for development/testing
2. Set up **lifecycle management** to automatically delete or archive old files
3. Use **cool or archive tiers** for infrequently accessed files
4. Monitor usage in Azure Portal → Cost Management

## Security Best Practices

1. **Rotate Keys Regularly**: Azure provides two keys (key1 and key2) to allow rotation without downtime
2. **Use Environment Variables**: Never commit connection strings to version control
3. **Restrict Network Access**: Consider enabling firewall rules to limit access to specific IPs
4. **Enable Logging**: Turn on diagnostic logging to monitor access and detect suspicious activity
5. **Use Azure Key Vault**: For production, consider storing secrets in Azure Key Vault
6. **Implement RBAC**: Use Azure Active Directory with role-based access control instead of connection strings for production environments

## Alternative: Using Azure CLI

You can also manage your storage account using Azure CLI:

```bash
# Login to Azure
az login

# Create resource group
az group create --name ebook-assistant-rg --location eastus

# Create storage account
az storage account create \
  --name ebookassistantstorage \
  --resource-group ebook-assistant-rg \
  --location eastus \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name ebookassistantstorage \
  --resource-group ebook-assistant-rg

# Create container
az storage container create \
  --name pdf-uploads \
  --connection-string "<your-connection-string>"
```

## Additional Resources

- [Azure Blob Storage Documentation](https://docs.microsoft.com/azure/storage/blobs/)
- [Azure Storage Python SDK Documentation](https://docs.microsoft.com/python/api/overview/azure/storage-blob-readme)
- [Azure Storage Explorer](https://azure.microsoft.com/features/storage-explorer/) - GUI tool for managing storage accounts

## Support

If you encounter issues not covered in this guide:
1. Check the Azure Portal for service health alerts
2. Review application logs for detailed error messages
3. Consult the Azure Storage documentation
4. Open an issue in the project repository

