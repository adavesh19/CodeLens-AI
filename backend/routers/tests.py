import os
import subprocess
import json
import sys
import re
from fastapi import APIRouter

router = APIRouter(tags=["tests"])

DEMO_PROJECT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "demo-project")
)


@router.post("/run-tests")
async def run_tests():
    """
    Run pytest on the demo project's test suite.
    Returns individual test results and summary.
    """
    tests_dir = os.path.join(DEMO_PROJECT_DIR, "tests")
    json_report_path = os.path.join(DEMO_PROJECT_DIR, "test_report.json")

    cmd = [
        sys.executable, "-m", "pytest",
        tests_dir,
        "-v",
        "--tb=short",
        "--json-report",
        f"--json-report-file={json_report_path}",
        "-p", "no:cacheprovider"
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=DEMO_PROJECT_DIR,
            timeout=60,
            env={**os.environ, "PYTHONPATH": DEMO_PROJECT_DIR}
        )
        output = (result.stdout or "") + "\n" + (result.stderr or "")
        returncode = result.returncode
    except subprocess.TimeoutExpired:
        return {
            "passed": 0, "failed": 1, "total": 1,
            "all_passed": False,
            "output": "Test execution timed out after 60 seconds",
            "test_details": [{"name": "Timeout", "status": "failed", "message": "Execution timed out"}]
        }
    except Exception as e:
        return {
            "passed": 0, "failed": 1, "total": 1,
            "all_passed": False,
            "output": f"Failed to run tests: {e}",
            "test_details": [{"name": "ExecutionError", "status": "failed", "message": str(e)}]
        }

    passed = 0
    failed = 0
    total = 0
    test_details = []

    # Try JSON report first
    if os.path.exists(json_report_path):
        try:
            with open(json_report_path, "r", encoding="utf-8") as f:
                report = json.load(f)

            for t in report.get("tests", []):
                nodeid = t.get("nodeid", "")
                name = nodeid.split("::")[-1] if "::" in nodeid else nodeid
                status = t.get("outcome", "failed")
                message = ""
                if status == "failed":
                    call_info = t.get("call", {}) or t.get("setup", {})
                    if call_info:
                        message = str(call_info.get("longrepr", ""))[:300]
                test_details.append({
                    "name": name,
                    "status": status,
                    "message": message
                })

            summary = report.get("summary", {})
            passed = summary.get("passed", 0)
            failed = summary.get("failed", 0)
            total = summary.get("total", len(test_details))
        except Exception:
            test_details = []

    # Fallback: parse stdout/stderr for test statuses
    if not test_details:
        for line in output.split("\n"):
            line = line.strip()
            m = re.match(r"(PASSED|FAILED|ERROR)\s+(.+)", line)
            if m:
                status_str = "passed" if m.group(1) == "PASSED" else "failed"
                nodeid = m.group(2).strip()
                name = nodeid.split("::")[-1] if "::" in nodeid else nodeid
                test_details.append({
                    "name": name,
                    "status": status_str,
                    "message": ""
                })

        passed = sum(1 for t in test_details if t["status"] == "passed")
        failed = sum(1 for t in test_details if t["status"] == "failed")
        total = len(test_details)

    # Check for SyntaxError or collection failure
    if total == 0 or returncode != 0 and passed == 0:
        if "SyntaxError" in output or "IndentationError" in output or "ERROR" in output or returncode != 0:
            failed = max(1, failed)
            total = max(1, total)
            if not test_details:
                err_line = [l for l in output.split("\n") if "SyntaxError" in l or "Error" in l or "ERROR" in l]
                errMsg = err_line[0].strip() if err_line else "Python syntax or collection error"
                test_details.append({
                    "name": "CollectionError",
                    "status": "failed",
                    "message": errMsg
                })

    all_passed = (failed == 0 and total > 0 and returncode == 0)

    return {
        "passed": passed,
        "failed": failed,
        "total": total,
        "all_passed": all_passed,
        "output": output,
        "test_details": test_details,
        "return_code": returncode
    }
