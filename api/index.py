import os
import base64
import sys
import mimetypes
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types

app = Flask(__name__)
# Enable CORS for our React frontend running on localhost:5173
CORS(app)

import json
from google.oauth2 import service_account

credentials = None
creds_project_id = None

# 1. Check for GOOGLE_APPLICATION_CREDENTIALS_JSON (ideal for Vercel/Production)
gcp_credentials_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if gcp_credentials_json:
    print("Found GOOGLE_APPLICATION_CREDENTIALS_JSON env var. Processing programmatic credentials...")
    try:
        cleaned_json = gcp_credentials_json.strip()
        if cleaned_json.startswith("'") and cleaned_json.endswith("'"):
            cleaned_json = cleaned_json[1:-1].strip()
        elif cleaned_json.startswith('"') and cleaned_json.endswith('"'):
            try:
                unescaped = json.loads(cleaned_json)
                if isinstance(unescaped, str):
                    cleaned_json = unescaped.strip()
            except Exception:
                cleaned_json = cleaned_json[1:-1].strip()

        try:
            creds_dict = json.loads(cleaned_json)
        except json.JSONDecodeError as je:
            print(f"Standard JSON load failed: {je}. Attempting auto-correction of quotes...")
            try:
                fixed_json = cleaned_json.replace("'", '"')
                creds_dict = json.loads(fixed_json)
                print("Successfully auto-corrected single quotes to double quotes!")
            except Exception:
                raise je

        raw_creds = service_account.Credentials.from_service_account_info(creds_dict)
        credentials = raw_creds.with_scopes(['https://www.googleapis.com/auth/cloud-platform'])
        creds_project_id = creds_dict.get("project_id")
        print(f"Programmatic credentials loaded successfully for project '{creds_project_id}'!")
    except Exception as e:
        print(f"Failed to load programmatically from GOOGLE_APPLICATION_CREDENTIALS_JSON: {e}")

# 2. Check for a local service-account.json in root or api/ (ideal for local development)
else:
    # Look in the parent of the api folder (project root) or api folder itself
    search_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "service-account.json"),
        os.path.join(os.path.dirname(__file__), "service-account.json"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "credentials.json")
    ]
    for path in search_paths:
        if os.path.exists(path):
            print(f"Found local credentials file at {path}. Loading programmatically...")
            try:
                with open(path, "r") as f:
                    creds_dict = json.load(f)
                raw_creds = service_account.Credentials.from_service_account_info(creds_dict)
                credentials = raw_creds.with_scopes(['https://www.googleapis.com/auth/cloud-platform'])
                creds_project_id = creds_dict.get("project_id")
                print(f"Local credentials loaded successfully for project '{creds_project_id}'!")
                break
            except Exception as e:
                print(f"Failed to load local service account file {path}: {e}")

print("Initializing Google Gen AI Client with Vertex AI...")
try:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or creds_project_id or "project-11977881-986e-4ab8-b4f"
    location_id = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    
    client_args = {
        "vertexai": True,
        "project": project_id,
        "location": location_id
    }
    if credentials:
        client_args["credentials"] = credentials
        print(f"Using programmatically loaded service account credentials for project '{project_id}'.")
    else:
        print("No programmatically loaded credentials found. Falling back to Application Default Credentials (ADC).")

    client = genai.Client(**client_args)
    print(f"Google Gen AI Client initialized successfully for project '{project_id}' at location '{location_id}'!")
except Exception as e:
    print(f"Failed to initialize Google Gen AI client: {e}")
    client = None

@app.route('/api/generate', methods=['POST'])
def generate_image_route():
    if not client:
        return jsonify({
            'success': False,
            'error': 'Google GenAI Client is not initialized. Check your credentials.'
        }), 500

    try:
        data = request.json
        prompt = data.get('prompt', '')
        model_selection = data.get('model', 'gemini-3.1-flash-image')
        ratio = data.get('ratio', '1:1')
        quality_selection = data.get('quality', '2K').upper() # Map standard selections like 1K, 2K, 4K
        uploaded_images = data.get('imagePrompts', []) # base64 strings

        if not prompt.strip():
            return jsonify({'success': False, 'error': 'Prompt cannot be empty.'}), 400

        # Build multimodal contents list
        contents = []

        # Process each uploaded style/reference image
        for idx, base64_str in enumerate(uploaded_images):
            if ',' in base64_str:
                header, base64_data = base64_str.split(',', 1)
            else:
                base64_data = base64_str
                header = "data:image/png;base64"

            mime_type = "image/png"
            if "image/jpeg" in header or "image/jpg" in header:
                mime_type = "image/jpeg"
            elif "image/webp" in header:
                mime_type = "image/webp"

            try:
                img_bytes = base64.b64decode(base64_data)
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                print(f"    Loaded reference image {idx + 1} (size: {len(img_bytes)} bytes)")
            except Exception as e:
                print(f"    Error decoding reference image {idx + 1}: {e}")

        # Append main prompt text
        contents.append(prompt)

        # Supported aspect ratios for Nano Banana 2
        valid_ratios = [
            "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", 
            "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"
        ]
        if ratio not in valid_ratios:
            ratio = "1:1"

        # Map UI qualities to Google ImageConfig size specifications ("1K", "2K", "4K")
        valid_sizes = ["1K", "2K", "4K"]
        image_size = quality_selection if quality_selection in valid_sizes else "2K"

        print(f"Dispatching request to Google GenAI Model: '{model_selection}'")
        print(f"   - Prompt: {prompt[:80]}...")
        print(f"   - Aspect Ratio: {ratio}")
        print(f"   - Quality Size: {image_size}")

        response = client.models.generate_content(
            model=model_selection,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio=ratio,
                    image_size=image_size
                )
            )
        )

        # Retrieve bytes from parts
        image_bytes = None
        if response.candidates and len(response.candidates) > 0:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    image_bytes = part.inline_data.data
                    break

        if not image_bytes:
            return jsonify({
                'success': False,
                'error': 'Google AI Model returned no image binary data.'
            }), 400

        # Encode bytes back to base64
        base64_encoded = base64.b64encode(image_bytes).decode('utf-8')
        return jsonify({
            'success': True,
            'image': f"data:image/png;base64,{base64_encoded}"
        })

    except Exception as e:
        print(f"Generation request failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Running local server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
