FROM autoagent-base

WORKDIR /app

COPY tests/ /app/tests/
COPY files/ /files/
COPY instruction.md /app/instruction.md

RUN mkdir -p /logs

CMD ["bash", "/app/tests/test.sh"]
