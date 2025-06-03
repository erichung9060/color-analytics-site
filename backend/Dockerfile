FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    libopenblas-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    cmake \
    build-essential \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

    
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python3", "src/main.py"]