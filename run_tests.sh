#!/bin/bash
# Test runner script with coverage reporting
# Usage: ./run_tests.sh [options]

set -e  # Exit on error

# Suppress Python ResourceWarnings
export PYTHONWARNINGS="ignore::ResourceWarning"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
COVERAGE=false
HTML_REPORT=false
VERBOSE=false
FAIL_UNDER=""
SPECIFIC_TEST=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --html|-h)
            HTML_REPORT=true
            COVERAGE=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --fail-under)
            FAIL_UNDER="$2"
            shift 2
            ;;
        --test|-t)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        --help)
            echo "Test Runner Script"
            echo ""
            echo "Usage: ./run_tests.sh [options]"
            echo ""
            echo "Options:"
            echo "  -c, --coverage        Run with coverage report"
            echo "  -h, --html           Generate HTML coverage report"
            echo "  -v, --verbose        Verbose test output"
            echo "  --fail-under NUM     Fail if coverage below NUM% (optional)"
            echo "  -t, --test PATH      Run specific test file or directory"
            echo "  --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run_tests.sh                                    # Run all tests"
            echo "  ./run_tests.sh --coverage                         # Run with coverage"
            echo "  ./run_tests.sh --html                             # Run with HTML report"
            echo "  ./run_tests.sh --coverage --fail-under 80         # Fail if coverage < 80%"
            echo "  ./run_tests.sh --test tests/test_models.py        # Run specific test"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build pytest command
PYTEST_CMD="pytest"

# Add verbosity
if [ "$VERBOSE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -v"
fi

# Add coverage options
if [ "$COVERAGE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD --cov=app --cov-report=term-missing"
    
    if [ "$HTML_REPORT" = true ]; then
        PYTEST_CMD="$PYTEST_CMD --cov-report=html"
    fi
    
    if [ -n "$FAIL_UNDER" ]; then
        PYTEST_CMD="$PYTEST_CMD --cov-fail-under=$FAIL_UNDER"
    fi
fi

# Add specific test if provided
if [ -n "$SPECIFIC_TEST" ]; then
    PYTEST_CMD="$PYTEST_CMD $SPECIFIC_TEST"
fi

# Print what we're doing
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Command: ${YELLOW}$PYTEST_CMD${NC}"
echo ""

# Run the tests
if eval $PYTEST_CMD; then
    echo ""
    echo -e "${GREEN}✓ All tests passed!${NC}"
    
    if [ "$HTML_REPORT" = true ]; then
        echo ""
        echo -e "${BLUE}HTML coverage report generated:${NC}"
        echo -e "${YELLOW}  open htmlcov/index.html${NC}"
    fi
    
    exit 0
else
    echo ""
    echo -e "${RED}✗ Tests failed!${NC}"
    exit 1
fi
