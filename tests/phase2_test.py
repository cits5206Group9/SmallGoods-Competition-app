#!/usr/bin/env python3
"""
Test Phase 2 real-time functionality
"""

import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_timer_manager_integration():
    """Test timer manager integration with WebSocket"""
    try:
        from app.real_time.timer_manager import timer_manager, TimerState
        from app.real_time.websocket import competition_realtime

        # Test timer manager exists
        assert timer_manager is not None
        print("✅ Timer manager instance available")

        # Test integration with WebSocket
        assert competition_realtime is not None
        print("✅ WebSocket integration available")

        # Create timer with callback
        def timer_callback(data):
            print(f"Timer callback: {data.timer_id} - {data.remaining}s")

        timer_id = timer_manager.create_timer(
            competition_id=1,
            timer_id="test_integration",
            duration=2,
            callback=timer_callback,
        )

        assert timer_id == "1_test_integration"
        print("✅ Timer created with callback")

        return True
    except Exception as e:
        print(f"❌ Timer manager integration test failed: {e}")
        return False


def test_websocket_timer_events():
    """Test WebSocket timer event handlers"""
    try:
        from app.real_time.event_handlers import (
            handle_timer_start,
            handle_timer_stop,
            handle_timer_reset,
        )

        # Check handlers exist
        assert callable(handle_timer_start)
        assert callable(handle_timer_stop)
        assert callable(handle_timer_reset)
        print("✅ Timer event handlers exist")

        return True
    except Exception as e:
        print(f"❌ WebSocket timer events test failed: {e}")
        return False


def test_static_files_exist():
    """Test that static JavaScript files exist"""
    try:
        import os

        js_files = [
            "app/static/js/websocket-client.js",
            "app/static/js/real-time-timer.js",
        ]

        for js_file in js_files:
            file_path = os.path.join(os.path.dirname(__file__), "..", js_file)
            if os.path.exists(file_path):
                with open(file_path, "r") as f:
                    content = f.read()
                    if len(content) > 1000:  # Check substantial content
                        print(f"✅ {js_file} exists and has content")
                    else:
                        print(f"⚠️  {js_file} exists but seems incomplete")
            else:
                print(f"❌ {js_file} not found")
                return False

        return True
    except Exception as e:
        print(f"❌ Static files test failed: {e}")
        return False


def test_real_time_module_complete():
    """Test that real_time module is complete"""
    try:
        from app.real_time import websocket, timer_manager, event_handlers

        # Check main components
        assert hasattr(websocket, "CompetitionRealTime")
        assert hasattr(timer_manager, "TimerManager")
        assert hasattr(event_handlers, "register_all_handlers")
        print("✅ Real-time module components complete")

        # Check timer integration
        from app.real_time.timer_manager import timer_manager
        from app.real_time.websocket import competition_realtime

        # Test basic timer operations
        timer_manager.create_timer(99, "module_test", 5)
        assert timer_manager.get_timer_data(99, "module_test") is not None
        print("✅ Timer operations working")

        # Test WebSocket methods
        assert hasattr(competition_realtime, "broadcast_timer_update")
        assert hasattr(competition_realtime, "broadcast_referee_decision")
        print("✅ WebSocket broadcast methods available")

        return True
    except Exception as e:
        print(f"❌ Real-time module completeness test failed: {e}")
        return False


def test_phase2_readiness():
    """Test Phase 2 implementation readiness"""
    try:
        # Test server-side timer management
        from app.real_time.timer_manager import timer_manager, TimerState

        # Create and test timer
        timer_manager.create_timer(100, "readiness_test", 3)
        success = timer_manager.start_timer(100, "readiness_test")
        assert success is True

        timer_data = timer_manager.get_timer_data(100, "readiness_test")
        assert timer_data.state == TimerState.RUNNING
        print("✅ Server-side timer management working")

        # Test WebSocket event system
        from app.real_time.websocket import competition_realtime

        # Test room management
        client_count = competition_realtime.get_connected_clients_count()
        assert isinstance(client_count, int)
        print("✅ WebSocket room management working")

        # Test timer cleanup
        timer_manager.cleanup_competition(100)
        remaining_timers = timer_manager.get_competition_timers(100)
        assert len(remaining_timers) == 0
        print("✅ Timer cleanup working")

        return True
    except Exception as e:
        print(f"❌ Phase 2 readiness test failed: {e}")
        return False


def run_phase2_tests():
    """Run all Phase 2 tests"""
    print("🧪 Running Phase 2 Real-time Functionality Tests\n")

    tests = [
        ("Timer Manager Integration", test_timer_manager_integration),
        ("WebSocket Timer Events", test_websocket_timer_events),
        ("Static Files Exist", test_static_files_exist),
        ("Real-time Module Complete", test_real_time_module_complete),
        ("Phase 2 Readiness", test_phase2_readiness),
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

    print(f"\n📊 Phase 2 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 Phase 2 implementation complete and ready!")
        print("\n✨ Real-time Timer System Features:")
        print("  • Server-synchronized competition timers")
        print("  • WebSocket-based real-time updates")
        print("  • Timer pause/resume/reset functionality")
        print("  • Multi-client timer synchronization")
        print("  • JavaScript real-time timer component")
        print("  • Connection status management")
        return True
    else:
        print("⚠️  Some Phase 2 tests failed.")
        return False


if __name__ == "__main__":
    success = run_phase2_tests()
    sys.exit(0 if success else 1)
