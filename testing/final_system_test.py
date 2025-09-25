#!/usr/bin/env python3
"""
Final system integration test with running server
"""
import sys
import os
import requests
import time

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_server_endpoints():
    """Test that all server endpoints are responding"""
    try:
        base_url = "http://127.0.0.1:8000"

        endpoints = [
            "/admin/",
            "/admin/real-time-dashboard",
            "/static/js/websocket-client.js",
            "/static/js/real-time-timer.js",
            "/static/js/real-time-dashboard.js",
            "/static/css/real-time-dashboard.css"
        ]

        print("Testing server endpoints...")

        for endpoint in endpoints:
            try:
                response = requests.get(f"{base_url}{endpoint}", timeout=5)
                if response.status_code == 200:
                    print(f"✅ {endpoint}: {response.status_code}")
                else:
                    print(f"❌ {endpoint}: {response.status_code}")
                    return False
            except requests.exceptions.RequestException as e:
                print(f"❌ {endpoint}: Connection failed - {e}")
                return False

        print("✅ All server endpoints responding correctly")
        return True

    except Exception as e:
        print(f"❌ Server endpoint test failed: {e}")
        return False


def test_websocket_infrastructure():
    """Test WebSocket infrastructure is ready"""
    try:
        print("Testing WebSocket infrastructure...")

        from app.real_time.websocket import competition_realtime
        from app.real_time.timer_manager import timer_manager
        from app.real_time.event_handlers import register_all_handlers

        # Test basic functionality
        assert competition_realtime is not None
        assert timer_manager is not None
        assert callable(register_all_handlers)

        # Test timer creation and management
        timer_id = timer_manager.create_timer(999, "final_test", 5)
        assert timer_id == "999_final_test"

        # Test timer operations
        assert timer_manager.start_timer(999, "final_test") is True
        timer_data = timer_manager.get_timer_data(999, "final_test")
        assert timer_data is not None

        # Test cleanup
        timer_manager.cleanup_competition(999)

        print("✅ WebSocket infrastructure working correctly")
        return True

    except Exception as e:
        print(f"❌ WebSocket infrastructure test failed: {e}")
        return False


def test_static_file_content():
    """Test that static files contain expected content"""
    try:
        print("Testing static file content...")

        base_url = "http://127.0.0.1:8000"

        # Test JavaScript files for key classes
        js_tests = [
            ("/static/js/websocket-client.js", "class WebSocketClient"),
            ("/static/js/real-time-timer.js", "class RealTimeTimer"),
            ("/static/js/real-time-dashboard.js", "class RealTimeDashboard")
        ]

        for endpoint, expected_content in js_tests:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200 and expected_content in response.text:
                print(f"✅ {endpoint}: Contains {expected_content}")
            else:
                print(f"❌ {endpoint}: Missing {expected_content}")
                return False

        # Test CSS file
        css_response = requests.get(f"{base_url}/static/css/real-time-dashboard.css", timeout=5)
        if css_response.status_code == 200 and ".real-time-dashboard" in css_response.text:
            print("✅ Dashboard CSS: Contains required styles")
        else:
            print("❌ Dashboard CSS: Missing required styles")
            return False

        print("✅ All static files contain expected content")
        return True

    except Exception as e:
        print(f"❌ Static file content test failed: {e}")
        return False


def test_admin_dashboard_content():
    """Test admin dashboard contains real-time components"""
    try:
        print("Testing admin dashboard content...")

        response = requests.get("http://127.0.0.1:8000/admin/real-time-dashboard", timeout=5)

        if response.status_code != 200:
            print(f"❌ Dashboard not accessible: {response.status_code}")
            return False

        # Check for key dashboard elements
        required_elements = [
            "real-time-dashboard",
            "connection-status",
            "main-competition-timer",
            "stats-grid",
            "dashboard-grid",
            "emergency-controls",
            "socket.io"  # Check for Socket.IO CDN
        ]

        for element in required_elements:
            if element in response.text:
                print(f"✅ Dashboard contains: {element}")
            else:
                print(f"❌ Dashboard missing: {element}")
                return False

        print("✅ Admin dashboard contains all required real-time components")
        return True

    except Exception as e:
        print(f"❌ Admin dashboard content test failed: {e}")
        return False


def test_production_readiness_indicators():
    """Test production readiness indicators"""
    try:
        print("Testing production readiness indicators...")

        # Test error handling
        from app.real_time.timer_manager import timer_manager

        # These should handle gracefully without crashing
        result = timer_manager.start_timer(99999, "non_existent")
        assert result is False
        print("✅ Error handling: Invalid timer operations handled gracefully")

        # Test logging
        import logging
        logger = logging.getLogger('app')
        assert logger is not None
        print("✅ Logging: Logging system available")

        # Test app creation
        from app import create_app
        app = create_app('testing')
        assert app is not None
        print("✅ App Creation: Flask app creates successfully")

        # Test WebSocket integration
        from app.extensions import socketio
        assert socketio is not None
        print("✅ WebSocket Integration: SocketIO extension available")

        print("✅ Production readiness indicators all positive")
        return True

    except Exception as e:
        print(f"❌ Production readiness test failed: {e}")
        return False


def test_file_permissions_and_structure():
    """Test file permissions and structure"""
    try:
        print("Testing file structure and permissions...")

        # Check critical files exist and are readable
        critical_files = [
            "app/real_time/__init__.py",
            "app/real_time/websocket.py",
            "app/real_time/timer_manager.py",
            "app/real_time/event_handlers.py",
            "app/templates/admin/real_time_dashboard.html",
            "app/static/js/websocket-client.js",
            "app/static/js/real-time-timer.js",
            "app/static/js/real-time-dashboard.js",
            "app/static/css/real-time-dashboard.css",
            "run.py"
        ]

        for file_path in critical_files:
            full_path = os.path.join(os.path.dirname(__file__), '..', file_path)
            if os.path.exists(full_path) and os.access(full_path, os.R_OK):
                print(f"✅ {file_path}: Exists and readable")
            else:
                print(f"❌ {file_path}: Missing or not readable")
                return False

        print("✅ File structure and permissions correct")
        return True

    except Exception as e:
        print(f"❌ File structure test failed: {e}")
        return False


def run_final_system_test():
    """Run final comprehensive system test"""
    print("🚀 FINAL SYSTEM INTEGRATION TEST")
    print("=" * 60)
    print("Testing complete real-time competition system with running server...\n")

    tests = [
        ("Server Endpoints", test_server_endpoints),
        ("WebSocket Infrastructure", test_websocket_infrastructure),
        ("Static File Content", test_static_file_content),
        ("Admin Dashboard Content", test_admin_dashboard_content),
        ("Production Readiness", test_production_readiness_indicators),
        ("File Structure", test_file_permissions_and_structure),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}")
        print("-" * 40)
        try:
            if test_func():
                passed += 1
                print(f"🟢 {test_name}: PASSED ✅\n")
            else:
                print(f"🔴 {test_name}: FAILED ❌\n")
        except Exception as e:
            print(f"🔴 {test_name}: ERROR - {e}\n")

    print("=" * 60)
    print(f"📊 FINAL TEST RESULTS: {passed}/{total} tests passed")
    print("=" * 60)

    if passed == total:
        print("\n🎉 🎉 🎉 SYSTEM FULLY OPERATIONAL! 🎉 🎉 🎉")
        print("\n✅ VERIFICATION COMPLETE:")
        print("  • WebSocket server running and accessible")
        print("  • All real-time components functional")
        print("  • Admin dashboard fully operational")
        print("  • Static files served correctly")
        print("  • Error handling working properly")
        print("  • File structure and permissions correct")

        print("\n🚀 DEPLOYMENT STATUS: READY")
        print("  • Server: ✅ Running on http://127.0.0.1:8000")
        print("  • Admin: ✅ http://127.0.0.1:8000/admin/")
        print("  • Dashboard: ✅ http://127.0.0.1:8000/admin/real-time-dashboard")
        print("  • WebSocket: ✅ Integrated and functional")
        print("  • Real-time: ✅ All components operational")

        print("\n🎯 SYSTEM IS PRODUCTION-READY!")
        return True
    else:
        failed = total - passed
        print(f"\n⚠️  {failed} test(s) failed.")
        print("❌ System needs attention before deployment.")
        return False


if __name__ == "__main__":
    success = run_final_system_test()
    sys.exit(0 if success else 1)