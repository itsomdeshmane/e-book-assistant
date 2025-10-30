# app/blob_storage.py
"""
Azure Blob Storage service for managing PDF file uploads.
Handles upload, download, deletion, and existence checks for blobs.
"""
import logging
from typing import Optional
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.core.exceptions import ResourceNotFoundError, AzureError

from .config import AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER_NAME

logger = logging.getLogger("blob_storage")
logging.basicConfig(level=logging.INFO)

# Initialize the BlobServiceClient
try:
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER_NAME)
    
    # Ensure container exists (create if not)
    try:
        container_client.create_container()
        logger.info(f"Created blob container: {AZURE_STORAGE_CONTAINER_NAME}")
    except Exception as e:
        # Container might already exist, which is fine
        if "ContainerAlreadyExists" in str(e) or "The specified container already exists" in str(e):
            logger.info(f"Blob container already exists: {AZURE_STORAGE_CONTAINER_NAME}")
        else:
            logger.warning(f"Container check/creation warning: {e}")
            
except Exception as e:
    logger.error(f"Failed to initialize Azure Blob Storage client: {e}")
    raise RuntimeError(f"Azure Blob Storage initialization failed: {e}")


def upload_to_blob(file_bytes: bytes, blob_name: str) -> str:
    """
    Upload file bytes to Azure Blob Storage.
    
    Args:
        file_bytes: The file content as bytes
        blob_name: The name for the blob (should include UUID for uniqueness)
        
    Returns:
        str: The blob name on success
        
    Raises:
        RuntimeError: If upload fails
    """
    try:
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(file_bytes, overwrite=False)
        logger.info(f"Successfully uploaded blob: {blob_name} ({len(file_bytes)} bytes)")
        return blob_name
    except Exception as e:
        logger.error(f"Failed to upload blob {blob_name}: {e}")
        raise RuntimeError(f"Azure Blob upload failed: {e}")


def download_from_blob(blob_name: str, local_path: str) -> None:
    """
    Download a blob from Azure Blob Storage to a local file.
    
    Args:
        blob_name: The name of the blob to download
        local_path: The local file path where the blob will be saved
        
    Raises:
        RuntimeError: If download fails
        FileNotFoundError: If blob doesn't exist
    """
    try:
        blob_client = container_client.get_blob_client(blob_name)
        
        with open(local_path, "wb") as f:
            download_stream = blob_client.download_blob()
            f.write(download_stream.readall())
            
        logger.info(f"Successfully downloaded blob: {blob_name} to {local_path}")
    except ResourceNotFoundError:
        logger.error(f"Blob not found: {blob_name}")
        raise FileNotFoundError(f"Blob not found in Azure Storage: {blob_name}")
    except Exception as e:
        logger.error(f"Failed to download blob {blob_name}: {e}")
        raise RuntimeError(f"Azure Blob download failed: {e}")


def delete_from_blob(blob_name: str) -> bool:
    """
    Delete a blob from Azure Blob Storage.
    
    Args:
        blob_name: The name of the blob to delete
        
    Returns:
        bool: True if deleted successfully, False if blob didn't exist
        
    Raises:
        RuntimeError: If deletion fails for reasons other than not found
    """
    try:
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.delete_blob()
        logger.info(f"Successfully deleted blob: {blob_name}")
        return True
    except ResourceNotFoundError:
        logger.warning(f"Blob not found for deletion: {blob_name}")
        return False
    except Exception as e:
        logger.error(f"Failed to delete blob {blob_name}: {e}")
        raise RuntimeError(f"Azure Blob deletion failed: {e}")


def blob_exists(blob_name: str) -> bool:
    """
    Check if a blob exists in Azure Blob Storage.
    
    Args:
        blob_name: The name of the blob to check
        
    Returns:
        bool: True if blob exists, False otherwise
    """
    try:
        blob_client = container_client.get_blob_client(blob_name)
        return blob_client.exists()
    except Exception as e:
        logger.error(f"Failed to check blob existence {blob_name}: {e}")
        return False


def get_blob_url(blob_name: str) -> Optional[str]:
    """
    Get the URL of a blob (useful for debugging or direct access if public).
    
    Args:
        blob_name: The name of the blob
        
    Returns:
        Optional[str]: The blob URL or None if error
    """
    try:
        blob_client = container_client.get_blob_client(blob_name)
        return blob_client.url
    except Exception as e:
        logger.error(f"Failed to get blob URL {blob_name}: {e}")
        return None

