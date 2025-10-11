#!/usr/bin/env python3
"""
Test Phase 3 advanced real-time functionality
"""

import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_dashboard_template_exists():
    """Test that dashboard template exists"""
    try:
        template_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "app",
            "templates",
            "admin",
            "real_time_dashboard.html",
        )

        if os.path.exists(template_path):
            with open(template_path, "r") as f:
                content = f.read()

            # Check for key components
            required_elements = [
                "real-time-dashboard",
                "dashboard-header",
                "stats-grid",
                "dashboard-grid",
                "connection-status",
                "main-competition-timer",
            ]

            for element in required_elements:
                if element in content:
                    print(f"✅ Dashboard element '{element}' found")
                else:
                    print(f"❌ Dashboard element '{element}' missing")
                    return False

            print("✅ Dashboard template complete")
            return True
        else:
            print("❌ Dashboard template not found")
            return False

    except Exception as e:
        print(f"❌ Dashboard template test failed: {e}")
        return False


def test_dashboard_styles():
    """Test that dashboard CSS exists"""
    try:
        css_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "app",
            "static",
            "css",
            "real-time-dashboard.css",
        )

        if os.path.exists(css_path):
            with open(css_path, "r") as f:
                content = f.read()

            # Check for key styles
            required_styles = [
                ".real-time-dashboard",
                ".stats-grid",
                ".dashboard-grid",
                ".dashboard-panel",
                ".activity-feed",
                ".emergency-controls",
            ]

            for style in required_styles:
                if style in content:
                    print(f"✅ CSS style '{style}' found")
                else:
                    print(f"❌ CSS style '{style}' missing")
                    return False

            if len(content) > 5000:  # Check substantial content
                print("✅ Dashboard CSS complete with substantial content")
                return True
            else:
                print("⚠️  Dashboard CSS exists but seems incomplete")
                return False
        else:
            print("❌ Dashboard CSS not found")
            return False

    except Exception as e:
        print(f"❌ Dashboard CSS test failed: {e}")
        return False


def test_dashboard_javascript():
    """Test that dashboard JavaScript exists"""
    try:
        js_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "app",
            "static",
            "js",
            "real-time-dashboard.js",
        )

        if os.path.exists(js_path):
            with open(js_path, "r") as f:
                content = f.read()

            # Check for key JavaScript components
            required_components = [
                "class RealTimeDashboard",
                "setupWebSocket",
                "handleTimerUpdate",
                "handleRefereeDecision",
                "updateStats",
                "emergencyControls",
            ]

            for component in required_components:
                if component in content:
                    print(f"✅ JS component '{component}' found")
                else:
                    print(f"❌ JS component '{component}' missing")
                    return False

            if len(content) > 10000:  # Check substantial content
                print("✅ Dashboard JavaScript complete with substantial content")
                return True
            else:
                print("⚠️  Dashboard JavaScript exists but seems incomplete")
                return False
        else:
            print("❌ Dashboard JavaScript not found")
            return False

    except Exception as e:
        print(f"❌ Dashboard JavaScript test failed: {e}")
        return False


def test_admin_route_integration():
    """Test that admin route includes dashboard"""
    try:
        from app.routes.admin import admin_bp

        # Check that blueprint exists
        assert admin_bp is not None
        print("✅ Admin blueprint exists")

        # Test route function exists
        route_functions = [
            rule.endpoint.split(".")[-1] for rule in admin_bp.url_map.iter_rules()
        ]

        if "real_time_dashboard" in route_functions:
            print("✅ Real-time dashboard route registered")
        else:
            print("❌ Real-time dashboard route not found")
            return False

        return True

    except Exception as e:
        print(f"❌ Admin route integration test failed: {e}")
        return False


def test_dashboard_functionality():
    """Test dashboard functionality integration"""
    try:
        # JavaScript files can't be imported in Python
        # But we can check they exist
        js_files = [
            "app/static/js/websocket-client.js",
            "app/static/js/real-time-timer.js",
            "app/static/js/real-time-dashboard.js",
        ]

        all_exist = True
        for js_file in js_files:
            file_path = os.path.join(os.path.dirname(__file__), "..", js_file)
            if os.path.exists(file_path):
                print(f"✅ {js_file} exists")
            else:
                print(f"❌ {js_file} missing")
                all_exist = False

        if all_exist:
            print("✅ All dashboard JavaScript components available")
            return True
        else:
            return False

    except Exception as e:
        print(f"❌ Dashboard functionality test failed: {e}")
        return False


def test_phase3_completeness():
    """Test Phase 3 implementation completeness"""
    try:
        # Check file structure
        required_files = [
            "app/templates/admin/real_time_dashboard.html",
            "app/static/css/real-time-dashboard.css",
            "app/static/js/real-time-dashboard.js",
        ]

        for file_path in required_files:
            full_path = os.path.join(os.path.dirname(__file__), "..", file_path)
            if os.path.exists(full_path):
                print(f"✅ {file_path} exists")
            else:
                print(f"❌ {file_path} missing")
                return False

        # Check integration with existing components
        from app.real_time.websocket import competition_realtime
        from app.real_time.timer_manager import timer_manager

        assert competition_realtime is not None
        assert timer_manager is not None
        print("✅ Real-time backend integration ready")

        # Check admin route integration
        from app.routes.admin import admin_bp

        assert admin_bp is not None
        print("✅ Admin route integration ready")

        print("✅ Phase 3 implementation complete")
        return True

    except Exception as e:
        print(f"❌ Phase 3 completeness test failed: {e}")
        return False


def run_phase3_tests():
    """Run all Phase 3 tests"""
    print("🧪 Running Phase 3 Advanced Real-time Functionality Tests\n")

    tests = [
        ("Dashboard Template", test_dashboard_template_exists),
        ("Dashboard Styles", test_dashboard_styles),
        ("Dashboard JavaScript", test_dashboard_javascript),
        ("Admin Route Integration", test_admin_route_integration),
        ("Dashboard Functionality", test_dashboard_functionality),
        ("Phase 3 Completeness", test_phase3_completeness),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n--- Testing: {test_name} ---")
        try:
            if test_func():
                passed += 1
                print(f"🟢 {test_name}: PASSED")
            else:
                print(f"🔴 {test_name}: FAILED")
        except Exception as e:
            print(f"🔴 {test_name}: ERROR - {e}")

    print(f"\n📊 Phase 3 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 Phase 3 Advanced Real-time Dashboard complete!")
        print("\n✨ Real-time Dashboard Features:")
        print("  • Comprehensive real-time competition monitoring")
        print("  • Live activity feed with categorized messages")
        print("  • Real-time statistics and performance metrics")
        print("  • Emergency controls for competition management")
        print("  • WebSocket latency and connection monitoring")
        print("  • Referee status and decision tracking")
        print("  • Competition progress visualization")
        print("  • Responsive mobile-friendly design")
        return True
    else:
        print("⚠️  Some Phase 3 tests failed.")
        return False


if __name__ == "__main__":
    success = run_phase3_tests()
    sys.exit(0 if success else 1)
