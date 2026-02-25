import sys
import requests
import json

def get_location(ip):
    try:
        # Using ip-api.com (free, no key required for low volume)
        response = requests.get(f"http://ip-api.com/json/{ip}")
        data = response.json()
        
        if data['status'] == 'success':
            return {
                "ip": data.get('query'),
                "country": data.get('country'),
                "state": data.get('regionName'),
                "city": data.get('city'),
                "isp": data.get('isp'),
                "success": True
            }
        else:
            return {"success": False, "message": data.get('message')}
    except Exception as e:
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ip_addr = sys.argv[1]
        result = get_location(ip_addr)
        print(json.dumps(result))
    else:
        print(json.dumps({"success": False, "message": "No IP provided"}))
