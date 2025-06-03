FROM python:3.10-bullseye

RUN apt-get update && apt-get install -y \
    libopenblas-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安裝預編譯 dlib wheel（直接下載，不透過 PyPI）
RUN pip install --upgrade pip && \
    pip install https://github.com/RalphMao/dlib-wheel/releases/download/v19.22.99/dlib-19.22.99-cp310-cp310-manylinux_2_27_x86_64.whl

# 安裝其他依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python3", "src/main.py"]