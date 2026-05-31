# Dockerfile voice-gateway (Phase 0 : squelette).
FROM python:3.11-slim
WORKDIR /app
COPY apps/voice-gateway/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/voice-gateway/ ./
ENV VOICE_GATEWAY_PORT=8080
EXPOSE 8080
CMD ["python", "-m", "src.main"]
