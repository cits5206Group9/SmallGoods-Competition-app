#!/usr/bin/env python3
"""
Simple test runner for WebSocket functionality without pytest dependency
"""
import sys
import os
import traceback

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def test_flask_socketio_import():
    """Test that Flask-SocketIO can be imported successfully"""
    try:
        import flask_socketio
        print("✅ Flask-SocketIO imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Failed to import Flask-SocketIO: {e}")
        return False

def test_socketio_dependencies():
    """Test that all SocketIO dependencies are available"""
    dependencies = ['python_socketio', 'eventlet']
    all_passed = True

    for dep in dependencies:
        try:
            __import__(dep)
            print(f"✅ {dep} imported successfully")
        except ImportError as e:
            print(f"❌ Failed to import {dep}: {e}")
            all_passed = False

    return all_passed

def test_extensions_import():
    """Test that extensions can be imported"""
    try:
        from app.extensions import socketio, db, migrate
        print("✅ Extensions imported successfully")

        # Check types
        from flask_sqlalchemy import SQLAlchemy
        from flask_migrate import Migrate
        from flask_socketio import SocketIO

        if isinstance(db, SQLAlchemy):
            print("✅ SQLAlchemy extension correct")
        if isinstance(migrate, Migrate):
            print("✅ Migrate extension correct")
        if isinstance(socketio, SocketIO):
            print("✅ SocketIO extension correct")

        return True
    except ImportError as e:
        print(f"❌ Failed to import extensions: {e}")
        traceback.print_exc()
        return False

def test_realtime_module():
    """Test real-time module functionality"""
    try:
        from app.real_time.websocket import CompetitionRealTime

        realtime = CompetitionRealTime()
        print("✅ CompetitionRealTime class created successfully")

        # Test initial state
        if isinstance(realtime.connected_clients, dict):
            print("✅ connected_clients is dict")
        if isinstance(realtime.competition_rooms, dict):
            print("✅ competition_rooms is dict")

        # Test methods exist
        required_methods = [
            'register_handlers', 'join_competition_room', 'leave_competition_room',
            'broadcast_to_competition', 'get_connected_clients_count'
        ]

        for method_name in required_methods:
            if hasattr(realtime, method_name) and callable(getattr(realtime, method_name)):
                print(f"✅ {method_name} method exists")
            else:
                print(f"❌ {method_name} method missing")
                return False

        return True
    except Exception as e:
        print(f"❌ Real-time module test failed: {e}")
        traceback.print_exc()
        return False

def test_event_handlers():
    """Test event handlers module"""
    try:
        from app.real_time.event_handlers import register_all_handlers
        print("✅ Event handlers imported successfully")

        # Test that functions exist
        from app.real_time import event_handlers

        handler_functions = [
            'handle_timer_start', 'handle_timer_stop', 'handle_referee_decision',
            'handle_attempt_result', 'handle_ping'
        ]

        for func_name in handler_functions:
            if hasattr(event_handlers, func_name):
                print(f"✅ {func_name} handler exists")
            else:
                print(f"❌ {func_name} handler missing")
                return False

        return True
    except Exception as e:
        print(f"❌ Event handlers test failed: {e}")
        traceback.print_exc()
        return False

def test_app_creation():
    """Test that app can be created with all extensions"""
    try:
        from app import create_app

        app = create_app('testing')
        print("✅ Flask app created successfully")

        # Check extensions are registered
        if hasattr(app, 'extensions'):
            if 'socketio' in app.extensions:
                print("✅ SocketIO extension registered in app")
            else:
                print("❌ SocketIO extension not registered")
                return False

        return True
    except Exception as e:
        print(f"❌ App creation test failed: {e}")
        traceback.print_exc()
        return False

def run_all_tests():
    """Run all tests and report results"""
    print("🧪 Running WebSocket Real-time System Tests\n")

    tests = [
        ("Flask-SocketIO Import", test_flask_socketio_import),
        ("SocketIO Dependencies", test_socketio_dependencies),
        ("Extensions Import", test_extensions_import),
        ("Real-time Module", test_realtime_module),
        ("Event Handlers", test_event_handlers),
        ("App Creation", test_app_creation),
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

    print(f"\n📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Ready for Phase 2 development.")
        return True
    else:
        print("⚠️  Some tests failed. Please fix issues before continuing.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)