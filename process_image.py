from PIL import Image
import sys

def process_image(input_path, output_path):
    # Open image and convert to RGBA
    img = Image.open(input_path).convert("RGBA")
    data = img.load()
    width, height = img.size
    
    # Tolerance for considering a pixel "white"
    threshold = 200
    
    # 1. Binarize slightly to ensure pure white and pure black (helps with anti-aliasing)
    for y in range(height):
        for x in range(width):
            r, g, b, a = data[x, y]
            if r > threshold and g > threshold and b > threshold:
                data[x, y] = (255, 255, 255, 255) # Pure White
            else:
                data[x, y] = (0, 0, 0, 255) # Pure Black
                
    # 2. Flood fill from the corners to find the outer background
    # and make it transparent.
    visited = set()
    queue = []
    
    # Add all edge pixels that are white to the queue
    for x in range(width):
        if data[x, 0] == (255, 255, 255, 255): queue.append((x, 0))
        if data[x, height-1] == (255, 255, 255, 255): queue.append((x, height-1))
    for y in range(height):
        if data[0, y] == (255, 255, 255, 255): queue.append((0, y))
        if data[width-1, y] == (255, 255, 255, 255): queue.append((width-1, y))
        
    for p in queue:
        visited.add(p)
        
    while queue:
        x, y = queue.pop(0)
        data[x, y] = (0, 0, 0, 0) # Transparent
        
        # Check neighbors
        for dx, dy in [(0,1), (1,0), (0,-1), (-1,0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in visited:
                    visited.add((nx, ny))
                    if data[nx, ny] == (255, 255, 255, 255):
                        queue.append((nx, ny))

    # Save output
    img.save(output_path, "PNG")
    print(f"Imagen procesada y guardada en {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\fernj\.gemini\antigravity-ide\brain\bbfa9f11-4586-4a41-84c5-25d5838897a2\media__1780797425333.jpg"
    output_file = r"d:\app web\buzos\public\buzo_base.png"
    process_image(input_file, output_file)
