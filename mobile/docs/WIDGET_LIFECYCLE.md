# Widget Lifecycle trong Flutter

## 📱 Tổng quan

Flutter có 2 loại widget chính với lifecycle khác nhau:
- **StatelessWidget** - Không có state, không có lifecycle methods
- **StatefulWidget** - Có state, có đầy đủ lifecycle methods

---

## 🔄 1. STATELESS WIDGET LIFECYCLE

### **Đơn giản nhất - Chỉ có 1 method**

```dart
class MyStatelessWidget extends StatelessWidget {
  const MyStatelessWidget({super.key});
  
  @override
  Widget build(BuildContext context) {
    // ✅ Được gọi mỗi khi parent rebuild
    // ✅ Không có state, không có lifecycle
    return Container(
      child: Text('Hello'),
    );
  }
}
```

**Lifecycle:**
```
1. Constructor được gọi
   ↓
2. build() được gọi
   ↓
3. Widget được render
   ↓
4. Parent rebuild → build() được gọi lại
```

---

## 🔄 2. STATEFUL WIDGET LIFECYCLE

### **Đầy đủ lifecycle methods**

```dart
class MyStatefulWidget extends StatefulWidget {
  const MyStatefulWidget({super.key});
  
  @override
  State<MyStatefulWidget> createState() => _MyStatefulWidgetState();
}

class _MyStatefulWidgetState extends State<MyStatefulWidget> {
  
  // ============================================
  // 1️⃣ INITIALIZATION PHASE
  // ============================================
  
  @override
  void initState() {
    super.initState();
    // ✅ Được gọi DUY NHẤT 1 LẦN khi State object được tạo
    // ✅ Chạy TRƯỚC build() đầu tiên
    // ✅ Không có BuildContext ở đây
    // ✅ Dùng để: khởi tạo data, subscribe streams, start animations
    
    print('1. initState() - Called once');
    
    // ⚠️ KHÔNG thể gọi setState() ở đây
    // ✅ CÓ THỂ gọi setState() trong Future/callback
    
    // Example: Fetch data after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // ✅ Safe to call setState here
      setState(() {
        // Update state
      });
    });
  }
  
  // ============================================
  // 2️⃣ DEPENDENCY CHANGE PHASE
  // ============================================
  
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // ✅ Được gọi NGAY SAU initState()
    // ✅ Được gọi lại khi InheritedWidget thay đổi
    // ✅ CÓ BuildContext ở đây
    // ✅ Dùng để: access InheritedWidget, Theme, MediaQuery
    
    print('2. didChangeDependencies() - Called after initState and when dependencies change');
    
    // Example: Access theme
    final theme = Theme.of(context);
    final mediaQuery = MediaQuery.of(context);
  }
  
  // ============================================
  // 3️⃣ BUILD PHASE
  // ============================================
  
  @override
  Widget build(BuildContext context) {
    // ✅ Được gọi SAU initState() và didChangeDependencies()
    // ✅ Được gọi lại mỗi khi setState() được gọi
    // ✅ Được gọi lại khi parent rebuild
    // ✅ CÓ THỂ được gọi nhiều lần
    // ⚠️ PHẢI return một Widget
    // ⚠️ KHÔNG được có side effects (API calls, setState, etc.)
    
    print('3. build() - Called multiple times');
    
    return Scaffold(
      appBar: AppBar(title: Text('Lifecycle Demo')),
      body: Center(
        child: Text('Hello World'),
      ),
    );
  }
  
  // ============================================
  // 4️⃣ UPDATE PHASE
  // ============================================
  
  @override
  void didUpdateWidget(covariant MyStatefulWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // ✅ Được gọi khi parent rebuild với CONFIGURATION MỚI
    // ✅ Được gọi TRƯỚC build()
    // ✅ Dùng để: so sánh old vs new widget properties
    
    print('4. didUpdateWidget() - Called when parent rebuilds with new config');
    
    // Example: Check if property changed
    if (widget.someProperty != oldWidget.someProperty) {
      // Do something
      setState(() {
        // Update state based on new property
      });
    }
  }
  
  // ============================================
  // 5️⃣ STATE CHANGE PHASE
  // ============================================
  
  void _updateState() {
    setState(() {
      // ✅ setState() triggers rebuild
      // ✅ build() sẽ được gọi lại
      print('setState() called - build() will be called next');
    });
  }
  
  // ============================================
  // 6️⃣ DEACTIVATION PHASE
  // ============================================
  
  @override
  void deactivate() {
    // ✅ Được gọi khi State object bị remove khỏi tree
    // ✅ Có thể được gọi nhiều lần (khi move trong tree)
    // ✅ Được gọi TRƯỚC dispose()
    
    print('5. deactivate() - Called when removed from tree');
    super.deactivate();
  }
  
  // ============================================
  // 7️⃣ DISPOSAL PHASE
  // ============================================
  
  @override
  void dispose() {
    // ✅ Được gọi khi State object bị remove VĨNH VIỄN
    // ✅ Được gọi DUY NHẤT 1 LẦN
    // ✅ Dùng để: cleanup resources, cancel subscriptions, dispose controllers
    
    print('6. dispose() - Called once when permanently removed');
    
    // Example: Cleanup
    // _controller.dispose();
    // _subscription.cancel();
    // _timer.cancel();
    
    super.dispose();
  }
}
```

---

## 📊 COMPLETE LIFECYCLE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                   STATEFUL WIDGET LIFECYCLE                  │
└─────────────────────────────────────────────────────────────┘

    Widget Created
         │
         ▼
    ┌─────────────────┐
    │  createState()  │  ← StatefulWidget tạo State object
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │   initState()   │  ← Called ONCE - Initialize data
    └────────┬────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ didChangeDependencies()  │  ← Called after initState
    └────────┬─────────────────┘  ← Called when InheritedWidget changes
             │
             ▼
    ┌─────────────────┐
    │     build()     │  ← Build UI
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Widget Mounted │  ← Widget is on screen
    └────────┬────────┘
             │
             │  ┌──────────────────┐
             │  │   setState()     │  ← Trigger rebuild
             │  └────────┬─────────┘
             │           │
             │           ▼
             │  ┌──────────────────┐
             ├──│     build()      │  ← Rebuild UI
             │  └──────────────────┘
             │
             │  ┌──────────────────────────┐
             │  │ Parent rebuilds with     │
             │  │ new configuration        │
             │  └────────┬─────────────────┘
             │           │
             │           ▼
             │  ┌──────────────────────────┐
             ├──│  didUpdateWidget()       │  ← Compare old vs new
             │  └────────┬─────────────────┘
             │           │
             │           ▼
             │  ┌──────────────────┐
             ├──│     build()      │  ← Rebuild with new config
             │  └──────────────────┘
             │
             │  ┌──────────────────────────┐
             │  │ InheritedWidget changes  │
             │  └────────┬─────────────────┘
             │           │
             │           ▼
             │  ┌──────────────────────────┐
             ├──│ didChangeDependencies()  │
             │  └────────┬─────────────────┘
             │           │
             │           ▼
             │  ┌──────────────────┐
             ├──│     build()      │
             │  └──────────────────┘
             │
             ▼
    ┌─────────────────┐
    │   deactivate()  │  ← Widget removed from tree
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    dispose()    │  ← Cleanup resources
    └────────┬────────┘
             │
             ▼
    Widget Destroyed
```

---

## 🎯 3. CONSUMER WIDGET LIFECYCLE (Riverpod)

### **ConsumerWidget - Stateless + Riverpod**

```dart
class MyConsumerWidget extends ConsumerWidget {
  const MyConsumerWidget({super.key});
  
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ✅ Giống StatelessWidget nhưng có thêm WidgetRef
    // ✅ ref.watch() → Subscribe to providers
    // ✅ ref.listen() → Side effects
    // ✅ ref.read() → One-time read
    
    final counter = ref.watch(counterProvider);
    
    return Text('$counter');
  }
}
```

**Lifecycle:**
```
1. Constructor
   ↓
2. build() - với WidgetRef
   ↓
3. ref.watch() subscribes to providers
   ↓
4. Provider changes → build() called again
```

---

### **ConsumerStatefulWidget - Stateful + Riverpod**

```dart
class MyConsumerStatefulWidget extends ConsumerStatefulWidget {
  const MyConsumerStatefulWidget({super.key});
  
  @override
  ConsumerState<MyConsumerStatefulWidget> createState() => _MyConsumerStatefulWidgetState();
}

class _MyConsumerStatefulWidgetState extends ConsumerState<MyConsumerStatefulWidget> {
  
  @override
  void initState() {
    super.initState();
    // ✅ Called once
    // ⚠️ CANNOT use ref.watch here
    // ✅ CAN use ref.read for one-time actions
    
    print('initState');
    
    // Example: Fetch data after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(dataProvider.notifier).fetchData();
    });
  }
  
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    print('didChangeDependencies');
  }
  
  @override
  Widget build(BuildContext context) {
    // ✅ Has access to 'ref' without parameter
    // ✅ ref.watch() → Subscribe
    // ✅ ref.listen() → Side effects
    // ✅ ref.read() → One-time read
    
    final data = ref.watch(dataProvider);
    
    // Listen for side effects
    ref.listen<AsyncValue<Data>>(dataProvider, (previous, next) {
      next.whenData((data) {
        if (data.hasError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: ${data.error}')),
          );
        }
      });
    });
    
    return data.when(
      loading: () => CircularProgressIndicator(),
      error: (err, stack) => Text('Error: $err'),
      data: (value) => Text('Data: $value'),
    );
  }
  
  @override
  void dispose() {
    // ✅ Cleanup resources
    print('dispose');
    super.dispose();
  }
}
```

**Lifecycle:**
```
1. createState()
   ↓
2. initState() - ref.read() only
   ↓
3. didChangeDependencies()
   ↓
4. build() - ref.watch(), ref.listen(), ref.read()
   ↓
5. Provider changes → build() called
   ↓
6. setState() → build() called
   ↓
7. dispose()
```

---

## 🔄 4. LIFECYCLE METHODS COMPARISON

| Method | Called When | Can use setState? | Can use BuildContext? | Use Case |
|--------|-------------|-------------------|----------------------|----------|
| **initState()** | Once, when created | ❌ No (but ✅ in callback) | ❌ No | Initialize data, start animations |
| **didChangeDependencies()** | After initState, when InheritedWidget changes | ✅ Yes | ✅ Yes | Access Theme, MediaQuery |
| **build()** | After init, on setState, on parent rebuild | ❌ No | ✅ Yes | Build UI |
| **didUpdateWidget()** | When parent rebuilds with new config | ✅ Yes | ✅ Yes | Compare old vs new props |
| **deactivate()** | When removed from tree | ✅ Yes | ✅ Yes | Temporary cleanup |
| **dispose()** | Once, when permanently removed | ❌ No | ❌ No | Final cleanup |

---

## 🎯 5. COMMON PATTERNS

### **Pattern 1: Fetch Data on Init**

```dart
@override
void initState() {
  super.initState();
  
  // ❌ BAD - setState in initState
  // setState(() { data = fetchData(); });
  
  // ✅ GOOD - Use addPostFrameCallback
  WidgetsBinding.instance.addPostFrameCallback((_) {
    _fetchData();
  });
}

Future<void> _fetchData() async {
  final data = await api.fetchData();
  if (mounted) {  // ✅ Check if still mounted
    setState(() {
      _data = data;
    });
  }
}
```

---

### **Pattern 2: Subscribe to Stream**

```dart
StreamSubscription? _subscription;

@override
void initState() {
  super.initState();
  
  // ✅ Subscribe to stream
  _subscription = myStream.listen((data) {
    if (mounted) {
      setState(() {
        _data = data;
      });
    }
  });
}

@override
void dispose() {
  // ✅ Cancel subscription
  _subscription?.cancel();
  super.dispose();
}
```

---

### **Pattern 3: Animation Controller**

```dart
late AnimationController _controller;

@override
void initState() {
  super.initState();
  
  // ✅ Create animation controller
  _controller = AnimationController(
    duration: Duration(seconds: 2),
    vsync: this,  // Requires SingleTickerProviderStateMixin
  );
  
  _controller.forward();
}

@override
void dispose() {
  // ✅ Dispose controller
  _controller.dispose();
  super.dispose();
}
```

---

### **Pattern 4: Text Editing Controller**

```dart
late TextEditingController _textController;

@override
void initState() {
  super.initState();
  
  // ✅ Create controller
  _textController = TextEditingController();
  
  // ✅ Listen to changes
  _textController.addListener(() {
    print('Text: ${_textController.text}');
  });
}

@override
void dispose() {
  // ✅ Dispose controller
  _textController.dispose();
  super.dispose();
}
```

---

### **Pattern 5: Focus Node**

```dart
late FocusNode _focusNode;

@override
void initState() {
  super.initState();
  
  // ✅ Create focus node
  _focusNode = FocusNode();
  
  // ✅ Listen to focus changes
  _focusNode.addListener(() {
    if (_focusNode.hasFocus) {
      print('TextField has focus');
    }
  });
}

@override
void dispose() {
  // ✅ Dispose focus node
  _focusNode.dispose();
  super.dispose();
}
```

---

### **Pattern 6: Riverpod - Fetch on Init**

```dart
class _MyScreenState extends ConsumerState<MyScreen> {
  @override
  void initState() {
    super.initState();
    
    // ✅ Use ref.read in addPostFrameCallback
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(dataProvider.notifier).fetchData();
    });
  }
  
  @override
  Widget build(BuildContext context) {
    // ✅ Use ref.watch in build
    final data = ref.watch(dataProvider);
    
    return data.when(
      loading: () => CircularProgressIndicator(),
      error: (err, stack) => Text('Error: $err'),
      data: (value) => Text('Data: $value'),
    );
  }
}
```

---

### **Pattern 7: Riverpod - Listen for Side Effects**

```dart
@override
Widget build(BuildContext context) {
  // ✅ Listen for side effects (show snackbar, navigate, etc.)
  ref.listen<AsyncValue<Result>>(resultProvider, (previous, next) {
    next.whenData((result) {
      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Success!')),
        );
      }
    });
  });
  
  final result = ref.watch(resultProvider);
  
  return Scaffold(...);
}
```

---

## ⚠️ 6. COMMON MISTAKES

### **❌ Mistake 1: setState in initState**

```dart
@override
void initState() {
  super.initState();
  
  // ❌ BAD - Cannot call setState in initState
  setState(() {
    _data = 'Hello';
  });
}
```

**✅ Fix:**
```dart
@override
void initState() {
  super.initState();
  
  // ✅ GOOD - Set directly without setState
  _data = 'Hello';
  
  // OR use addPostFrameCallback
  WidgetsBinding.instance.addPostFrameCallback((_) {
    setState(() {
      _data = 'Hello';
    });
  });
}
```

---

### **❌ Mistake 2: Using BuildContext in initState**

```dart
@override
void initState() {
  super.initState();
  
  // ❌ BAD - BuildContext not available yet
  final theme = Theme.of(context);
}
```

**✅ Fix:**
```dart
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  
  // ✅ GOOD - BuildContext available here
  final theme = Theme.of(context);
}
```

---

### **❌ Mistake 3: Not disposing resources**

```dart
late TextEditingController _controller;

@override
void initState() {
  super.initState();
  _controller = TextEditingController();
}

// ❌ BAD - No dispose() method
```

**✅ Fix:**
```dart
@override
void dispose() {
  // ✅ GOOD - Always dispose
  _controller.dispose();
  super.dispose();
}
```

---

### **❌ Mistake 4: Using setState after dispose**

```dart
Future<void> _fetchData() async {
  final data = await api.fetchData();
  
  // ❌ BAD - Widget might be disposed
  setState(() {
    _data = data;
  });
}
```

**✅ Fix:**
```dart
Future<void> _fetchData() async {
  final data = await api.fetchData();
  
  // ✅ GOOD - Check if mounted
  if (mounted) {
    setState(() {
      _data = data;
    });
  }
}
```

---

### **❌ Mistake 5: ref.watch in initState (Riverpod)**

```dart
@override
void initState() {
  super.initState();
  
  // ❌ BAD - Cannot use ref.watch in initState
  final data = ref.watch(dataProvider);
}
```

**✅ Fix:**
```dart
@override
void initState() {
  super.initState();
  
  // ✅ GOOD - Use ref.read
  final data = ref.read(dataProvider);
  
  // OR use in addPostFrameCallback
  WidgetsBinding.instance.addPostFrameCallback((_) {
    ref.read(dataProvider.notifier).fetchData();
  });
}
```

---

## 📚 SUMMARY

### **StatelessWidget**
- Chỉ có `build()`
- Không có state
- Rebuild khi parent rebuild

### **StatefulWidget**
- Có đầy đủ lifecycle: `initState` → `didChangeDependencies` → `build` → `didUpdateWidget` → `deactivate` → `dispose`
- Có state, có thể gọi `setState()`
- Cần dispose resources

### **ConsumerWidget (Riverpod)**
- Giống StatelessWidget + `WidgetRef`
- Có `ref.watch()`, `ref.listen()`, `ref.read()`

### **ConsumerStatefulWidget (Riverpod)**
- Giống StatefulWidget + `WidgetRef`
- `ref.read()` trong `initState`
- `ref.watch()` trong `build()`

---

## 🎯 Best Practices

1. ✅ Always dispose controllers, subscriptions, timers
2. ✅ Check `mounted` before calling `setState()` in async callbacks
3. ✅ Use `addPostFrameCallback` for actions after first frame
4. ✅ Use `didChangeDependencies()` to access InheritedWidget
5. ✅ Use `ref.read()` in `initState`, `ref.watch()` in `build()`
6. ✅ Keep `build()` pure - no side effects
7. ✅ Use `ref.listen()` for side effects (navigation, snackbars)
