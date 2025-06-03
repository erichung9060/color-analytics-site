FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    libopenblas-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安裝其他依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python3", "src/main.py"]