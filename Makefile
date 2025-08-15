.PHONY: fmt lint test run migrate-up
fmt:
	black . && isort .
lint:
	flake8 .
test:
	pytest -q
run:
	flask --app src/app --debug run
migrate-init:
	flask db init
migrate:
	flask db migrate -m "auto"
migrate-up:
	flask db upgrade
