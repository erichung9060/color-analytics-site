import requests
import json
import time
import base64
import os
import re

FLUX_API_ADDRESS = os.getenv('FLUX_API_ADDRESS')
FLUX_OUTPUT_API_ADDRESS = os.getenv('FLUX_OUTPUT_API_ADDRESS')

def get_error_img():
    with open("static/error.jpg", "rb") as image_file:
        image_data = image_file.read()
        base64_encoded_data = base64.b64encode(image_data)
        image = base64_encoded_data.decode('utf-8')
        return image
    
async def generate_image_from_flux(prompt):
    print("generating image from flux")

    results = []
    image = await prompt_to_image(prompt)

    if image == None:
        image = get_error_img()
        print("error on flux prompt_to_image()")

    results.append({
        "style": "Recommend",
        "image": image
    })
    
    clean_gpu()
    return results


async def prompt_to_image(prompt):
    try:
        with open("docs/flux_config.json", "r") as f:
            workflow = json.load(f)

        workflow["28"]["inputs"]["string"] = prompt

        res = requests.post(f"{FLUX_API_ADDRESS}/prompt", json={"prompt": workflow})
        res.raise_for_status()
        res_data = res.json()

        prompt_id = res_data["prompt_id"]

        print(f"🟡 Task submitted, Prompt ID: {prompt_id}")

        while True:
            queue = requests.get(f"{FLUX_API_ADDRESS}/queue").json()
            if not queue["queue_pending"] and not queue["queue_running"]:
                print("✅ Task completed!")
                break
            time.sleep(1)

        image_list = requests.get(FLUX_OUTPUT_API_ADDRESS).text
        
        matches = re.findall(r'href="([^"]+\.png)"', image_list)
        if not matches:
            print("⚠️ Image not found.")
            return None

        latest_image = matches[-1]
        image_url = f"{FLUX_OUTPUT_API_ADDRESS}/{latest_image}"
        print(f"🖼️ Image found: {image_url}")

        res = requests.get(image_url)
        image_data = res.content
        base64_encoded_data = base64.b64encode(image_data)
        base64_image = base64_encoded_data.decode('utf-8')
        
        return base64_image
    
    except Exception as e:
        print(f"[flux prompt_to_image] {str(e)}")
        return None
    
def clean_gpu():
    try:
        response = requests.post('http://140.116.154.71:7862/api/easyuse/cleangpu')
        response.raise_for_status()
        print("✅ VRAM released successfully")
    except Exception as e:
        print(f"[flux release_vram] {str(e)}")