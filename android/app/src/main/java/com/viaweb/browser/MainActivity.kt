package com.viaweb.browser

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.bottomsheet.BottomSheetDialog
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayInputStream
import java.net.URLEncoder
import java.util.concurrent.atomic.AtomicInteger

class MainActivity : AppCompatActivity() {

    private data class BrowserTab(
        val id: String,
        val webView: WebView,
        var title: String = "الصفحة الرئيسية",
        var currentUrl: String = HOME_URL,
        val isIncognito: Boolean = false
    )

    private lateinit var prefs: SharedPreferences
    private lateinit var webViewContainer: FrameLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var bottomBar: LinearLayout
    private lateinit var addressPill: LinearLayout
    private lateinit var tvAddress: TextView
    private lateinit var tvTabCount: TextView
    private lateinit var btnBack: ImageButton
    private lateinit var btnForward: ImageButton
    private lateinit var btnReload: ImageButton
    private lateinit var btnTabs: FrameLayout
    private lateinit var btnMenu: ImageButton

    private val tabs = mutableListOf<BrowserTab>()
    private var activeTabIndex = 0
    private var tabCounter = 0

    // Settings
    private var adBlockEnabled = true
    private var noImagesEnabled = false
    private var desktopModeEnabled = false
    private var darkModeEnabled = false
    private var searchEngine = "google"

    // Stats
    private val blockedCount = AtomicInteger(0)

    // File chooser callback
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback ?: return@registerForActivityResult
        filePathCallback = null
        val results = if (result.resultCode == RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else {
            null
        }
        callback.onReceiveValue(results)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        prefs = getSharedPreferences("viaweb_prefs", Context.MODE_PRIVATE)
        loadSettings()
        applyNightModePreference()

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webViewContainer = findViewById(R.id.webViewContainer)
        progressBar = findViewById(R.id.progressBar)
        bottomBar = findViewById(R.id.bottomBar)
        addressPill = findViewById(R.id.addressPill)
        tvAddress = findViewById(R.id.tvAddress)
        tvTabCount = findViewById(R.id.tvTabCount)
        btnBack = findViewById(R.id.btnBack)
        btnForward = findViewById(R.id.btnForward)
        btnReload = findViewById(R.id.btnReload)
        btnTabs = findViewById(R.id.btnTabs)
        btnMenu = findViewById(R.id.btnMenu)

        applyToolbarThemeColors()
        setupListeners()
        setupBackNavigation()

        val incomingUrl = intent?.dataString
        val savedUrls = savedInstanceState?.getStringArrayList("saved_tab_urls")
        val savedIncognito = savedInstanceState?.getBooleanArray("saved_tab_incognito")
        val savedActiveIdx = savedInstanceState?.getInt("saved_active_tab", 0) ?: 0

        if (!incomingUrl.isNullOrBlank()) {
            createNewTab(initialUrl = incomingUrl)
        } else if (!savedUrls.isNullOrEmpty()) {
            savedUrls.forEachIndexed { idx, url ->
                val incognito = savedIncognito?.getOrNull(idx) ?: false
                createNewTab(initialUrl = url, isIncognito = incognito)
            }
            if (savedActiveIdx in tabs.indices) {
                switchToTab(savedActiveIdx)
            }
        } else {
            createNewTab(initialUrl = HOME_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putStringArrayList("saved_tab_urls", ArrayList(tabs.map { it.currentUrl }))
        outState.putBooleanArray("saved_tab_incognito", tabs.map { it.isIncognito }.toBooleanArray())
        outState.putInt("saved_active_tab", activeTabIndex)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val incomingUrl = intent.dataString
        if (!incomingUrl.isNullOrBlank()) {
            createNewTab(initialUrl = incomingUrl)
        }
    }

    override fun onDestroy() {
        webViewContainer.removeAllViews()
        tabs.forEach {
            it.webView.stopLoading()
            it.webView.destroy()
        }
        tabs.clear()
        super.onDestroy()
    }

    private fun loadSettings() {
        adBlockEnabled = prefs.getBoolean("ad_block", true)
        noImagesEnabled = prefs.getBoolean("no_images", false)
        desktopModeEnabled = prefs.getBoolean("desktop_mode", false)
        darkModeEnabled = prefs.getBoolean("dark_mode", false)
        searchEngine = prefs.getString("search_engine", "google") ?: "google"
        blockedCount.set(prefs.getInt("blocked_count", 0))
    }

    private fun saveSettings() {
        prefs.edit()
            .putBoolean("ad_block", adBlockEnabled)
            .putBoolean("no_images", noImagesEnabled)
            .putBoolean("desktop_mode", desktopModeEnabled)
            .putBoolean("dark_mode", darkModeEnabled)
            .putString("search_engine", searchEngine)
            .putInt("blocked_count", blockedCount.get())
            .apply()
    }

    private fun applyNightModePreference() {
        val targetMode = if (darkModeEnabled) {
            AppCompatDelegate.MODE_NIGHT_YES
        } else {
            AppCompatDelegate.MODE_NIGHT_NO
        }
        if (AppCompatDelegate.getDefaultNightMode() != targetMode) {
            AppCompatDelegate.setDefaultNightMode(targetMode)
        }
    }

    private fun isCurrentlyDark(): Boolean {
        val nightMask = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return darkModeEnabled || nightMask == Configuration.UI_MODE_NIGHT_YES
    }

    private fun applyToolbarThemeColors() {
        val dark = isCurrentlyDark()
        val barBg = if (dark) Color.parseColor("#161B22") else Color.parseColor("#FFFFFF")
        val iconTint = if (dark) Color.parseColor("#E2E8F0") else Color.parseColor("#334155")
        val textColor = if (dark) Color.parseColor("#E2E8F0") else Color.parseColor("#0F172A")

        bottomBar.setBackgroundColor(barBg)
        tvAddress.setTextColor(textColor)
        tvTabCount.setTextColor(iconTint)
        btnBack.setColorFilter(iconTint)
        btnForward.setColorFilter(iconTint)
        btnReload.setColorFilter(iconTint)
        btnMenu.setColorFilter(iconTint)
    }

    private fun setupListeners() {
        btnBack.setOnClickListener {
            val tab = currentTab() ?: return@setOnClickListener
            if (tab.webView.canGoBack()) {
                tab.webView.goBack()
            } else if (tab.currentUrl != HOME_URL) {
                loadHomePage(tab)
            }
        }

        btnForward.setOnClickListener {
            val tab = currentTab() ?: return@setOnClickListener
            if (tab.webView.canGoForward()) {
                tab.webView.goForward()
            }
        }

        btnReload.setOnClickListener {
            val tab = currentTab() ?: return@setOnClickListener
            if (tab.currentUrl == HOME_URL) {
                loadHomePage(tab)
            } else {
                tab.webView.reload()
            }
        }

        addressPill.setOnClickListener { showAddressDialog() }
        tvAddress.setOnClickListener { showAddressDialog() }
        btnTabs.setOnClickListener { showTabsSheet() }
        btnMenu.setOnClickListener { showViaMenuSheet() }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val tab = currentTab()
                if (tab != null && tab.webView.canGoBack()) {
                    tab.webView.goBack()
                } else if (tab != null && tab.currentUrl != HOME_URL) {
                    loadHomePage(tab)
                } else if (tabs.size > 1) {
                    closeTabAt(activeTabIndex)
                } else {
                    finish()
                }
            }
        })
    }

    private fun currentTab(): BrowserTab? = tabs.getOrNull(activeTabIndex)

    @SuppressLint("SetJavaScriptEnabled")
    private fun createConfiguredWebView(tabId: String, isIncognito: Boolean): WebView {
        val webView = WebView(this)
        webView.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = !isIncognito
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.allowFileAccess = false

        applyWebViewSettings(webView)

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            startFileDownload(url, userAgent, contentDisposition, mimetype)
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                val active = currentTab() ?: return
                if (active.id != tabId) return
                if (newProgress in 1..99) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                val t = tabs.find { it.id == tabId } ?: return
                if (!title.isNullOrBlank() && t.currentUrl != HOME_URL) {
                    t.title = title
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                return try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (adBlockEnabled && request != null && !request.isForMainFrame) {
                    val host = request.url.host?.lowercase() ?: ""
                    if (AD_HOSTS.any { host == it || host.endsWith(".$it") }) {
                        blockedCount.incrementAndGet()
                        saveSettings()
                        return WebResourceResponse(
                            "text/plain",
                            "utf-8",
                            ByteArrayInputStream(ByteArray(0))
                        )
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith(HOME_BASE_URL)) {
                    val uri = Uri.parse(url)
                    val q = uri.getQueryParameter("q")?.trim().orEmpty()
                    val engine = uri.getQueryParameter("engine")
                    if (!engine.isNullOrBlank()) {
                        searchEngine = engine
                        saveSettings()
                    }
                    if (q.isNotEmpty()) {
                        val tab = tabs.find { it.id == tabId }
                        if (tab != null) {
                            navigateInput(tab, q)
                        }
                    }
                    return true
                }

                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false
                }

                // External schemes like tel:, mailto:, intent://
                return try {
                    val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    startActivity(intent)
                    true
                } catch (_: Exception) {
                    true
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                val tab = tabs.find { it.id == tabId } ?: return
                val actualUrl = url ?: return
                if (actualUrl.startsWith(HOME_BASE_URL) || actualUrl == "about:blank") {
                    if (tab.currentUrl == HOME_URL) {
                        tab.title = if (tab.isIncognito) "تبويب خفي" else "الصفحة الرئيسية"
                    }
                } else {
                    tab.currentUrl = actualUrl
                    val pageTitle = view?.title
                    if (!pageTitle.isNullOrBlank()) {
                        tab.title = pageTitle
                    }
                    if (!tab.isIncognito) {
                        addToHistory(tab.title, actualUrl)
                    }
                }
                if (currentTab()?.id == tabId) {
                    updateToolbarState()
                }
            }
        }

        return webView
    }

    private fun applyWebViewSettings(webView: WebView) {
        val settings = webView.settings
        settings.loadsImagesAutomatically = !noImagesEnabled
        settings.blockNetworkImage = noImagesEnabled
        settings.userAgentString = if (desktopModeEnabled) DESKTOP_UA else MOBILE_UA

        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isCurrentlyDark())
        }
    }

    private fun createNewTab(initialUrl: String = HOME_URL, isIncognito: Boolean = false) {
        tabCounter += 1
        val tabId = "tab-$tabCounter"
        val webView = createConfiguredWebView(tabId, isIncognito)
        val tab = BrowserTab(
            id = tabId,
            webView = webView,
            title = if (isIncognito) "تبويب خفي" else "الصفحة الرئيسية",
            currentUrl = initialUrl,
            isIncognito = isIncognito
        )
        tabs.add(tab)
        switchToTab(tabs.size - 1)

        if (initialUrl == HOME_URL) {
            loadHomePage(tab)
        } else {
            navigateInput(tab, initialUrl)
        }
    }

    private fun switchToTab(index: Int) {
        if (index !in tabs.indices) return
        activeTabIndex = index
        val tab = tabs[index]
        webViewContainer.removeAllViews()
        webViewContainer.addView(tab.webView)
        updateToolbarState()
    }

    private fun closeTabAt(index: Int) {
        if (index !in tabs.indices) return
        val removed = tabs.removeAt(index)
        webViewContainer.removeView(removed.webView)
        removed.webView.stopLoading()
        removed.webView.destroy()

        if (tabs.isEmpty()) {
            createNewTab(initialUrl = HOME_URL)
        } else {
            val nextIdx = index.coerceAtMost(tabs.size - 1)
            switchToTab(nextIdx)
        }
    }

    private fun loadHomePage(tab: BrowserTab) {
        tab.currentUrl = HOME_URL
        tab.title = if (tab.isIncognito) "تبويب خفي" else "الصفحة الرئيسية"
        tab.webView.loadDataWithBaseURL(
            HOME_BASE_URL,
            buildStartPageHtml(tab.isIncognito),
            "text/html",
            "UTF-8",
            null
        )
        updateToolbarState()
    }

    private fun navigateInput(tab: BrowserTab, rawInput: String) {
        val trimmed = rawInput.trim()
        if (trimmed.isEmpty() || trimmed == HOME_URL) {
            loadHomePage(tab)
            return
        }

        val targetUrl = normalizeToUrlOrSearch(trimmed)
        tab.currentUrl = targetUrl
        tab.webView.loadUrl(targetUrl)
        updateToolbarState()
    }

    private fun normalizeToUrlOrSearch(input: String): String {
        val lower = input.lowercase()
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            return input
        }
        val looksLikeDomain = !input.contains(" ") &&
            Regex("^[a-zA-Z0-9\\u0600-\\u06FF-]+(\\.[a-zA-Z0-9\\u0600-\\u06FF-]+)+(:\\d+)?(/.*)?$")
                .matches(input)
        if (looksLikeDomain) {
            return "https://$input"
        }

        val encoded = URLEncoder.encode(input, "UTF-8")
        return when (searchEngine) {
            "duckduckgo" -> "https://duckduckgo.com/?q=$encoded"
            "bing" -> "https://www.bing.com/search?q=$encoded"
            "wikipedia" -> "https://ar.wikipedia.org/w/index.php?search=$encoded"
            else -> "https://www.google.com/search?q=$encoded"
        }
    }

    private fun updateToolbarState() {
        val tab = currentTab() ?: return
        tvTabCount.text = tabs.size.toString()

        val canBack = tab.webView.canGoBack() || tab.currentUrl != HOME_URL
        val canForward = tab.webView.canGoForward()

        btnBack.isEnabled = canBack
        btnBack.alpha = if (canBack) 1.0f else 0.35f
        btnForward.isEnabled = canForward
        btnForward.alpha = if (canForward) 1.0f else 0.35f

        tvAddress.text = when {
            tab.currentUrl == HOME_URL -> if (tab.isIncognito) "تبويب خفي — ابحث أو أدخل رابطاً…" else getString(R.string.address_placeholder)
            else -> {
                val host = Uri.parse(tab.currentUrl).host?.removePrefix("www.")
                host ?: tab.currentUrl
            }
        }
    }

    private fun showAddressDialog() {
        val tab = currentTab() ?: return
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 16)
        }
        val input = EditText(this).apply {
            hint = "أدخل رابط الموقع أو ابحث…"
            setSingleLine(true)
            imeOptions = EditorInfo.IME_ACTION_GO
            if (tab.currentUrl != HOME_URL) {
                setText(tab.currentUrl)
                selectAll()
            }
        }
        container.addView(input)

        val dialog = AlertDialog.Builder(this)
            .setTitle("الانتقال إلى موقع أو بحث")
            .setView(container)
            .setPositiveButton("انتقال") { _, _ ->
                navigateInput(tab, input.text.toString())
            }
            .setNegativeButton("إلغاء", null)
            .create()

        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                navigateInput(tab, input.text.toString())
                dialog.dismiss()
                true
            } else {
                false
            }
        }
        dialog.show()
        input.requestFocus()
    }

    private fun showTabsSheet() {
        val sheet = BottomSheetDialog(this)
        val dark = isCurrentlyDark()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 32, 36, 36)
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(if (dark) Color.parseColor("#161B22") else Color.WHITE)
        }

        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 24)
        }
        val titleTv = TextView(this).apply {
            text = "التبويبات المفتوحة (${tabs.size})"
            textSize = 16f
            setTypeface(null, Typeface.BOLD)
            setTextColor(if (dark) Color.WHITE else Color.parseColor("#0F172A"))
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val closeAllBtn = TextView(this).apply {
            text = "إغلاق الكل"
            textSize = 13f
            setTextColor(Color.parseColor("#DC2626"))
            setPadding(16, 12, 16, 12)
            setOnClickListener {
                webViewContainer.removeAllViews()
                while (tabs.isNotEmpty()) {
                    val t = tabs.removeAt(0)
                    t.webView.stopLoading()
                    t.webView.destroy()
                }
                createNewTab(HOME_URL)
                sheet.dismiss()
            }
        }
        headerRow.addView(titleTv)
        headerRow.addView(closeAllBtn)
        root.addView(headerRow)

        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        val listLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        tabs.forEachIndexed { idx, tab ->
            val isActive = idx == activeTabIndex
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(24, 20, 24, 20)
                val bg = GradientDrawable().apply {
                    cornerRadius = 24f
                    setColor(
                        when {
                            isActive && dark -> Color.parseColor("#1E3A5F")
                            isActive -> Color.parseColor("#EFF6FF")
                            dark -> Color.parseColor("#0D1117")
                            else -> Color.parseColor("#F8FAFC")
                        }
                    )
                    setStroke(
                        2,
                        if (isActive) Color.parseColor("#2563EB") else Color.parseColor("#3364748B")
                    )
                }
                background = bg
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                lp.bottomMargin = 16
                layoutParams = lp
            }

            val textCol = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    switchToTab(idx)
                    sheet.dismiss()
                }
            }
            val tTitle = TextView(this).apply {
                text = tab.title
                textSize = 14f
                setTypeface(null, Typeface.BOLD)
                maxLines = 1
                setTextColor(if (dark) Color.WHITE else Color.parseColor("#0F172A"))
            }
            val tSub = TextView(this).apply {
                text = if (tab.isIncognito) "تبويب خفي" else (Uri.parse(tab.currentUrl).host ?: "الرئيسية")
                textSize = 12f
                maxLines = 1
                setTextColor(Color.parseColor("#64748B"))
            }
            textCol.addView(tTitle)
            textCol.addView(tSub)

            val closeOne = TextView(this).apply {
                text = "✕"
                textSize = 16f
                setPadding(24, 12, 24, 12)
                setTextColor(Color.parseColor("#94A3B8"))
                setOnClickListener {
                    closeTabAt(idx)
                    sheet.dismiss()
                }
            }

            row.addView(textCol)
            row.addView(closeOne)
            listLayout.addView(row)
        }
        scroll.addView(listLayout)
        root.addView(scroll)

        val actionsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 20, 0, 0)
        }
        val newTabBtn = makeActionPillButton("+ تبويب جديد", true, dark) {
            createNewTab(HOME_URL, isIncognito = false)
            sheet.dismiss()
        }
        val incognitoBtn = makeActionPillButton("تبويب خفي", false, dark) {
            createNewTab(HOME_URL, isIncognito = true)
            sheet.dismiss()
        }
        actionsRow.addView(newTabBtn)
        actionsRow.addView(incognitoBtn)
        root.addView(actionsRow)

        sheet.setContentView(root)
        sheet.show()
    }

    private fun showViaMenuSheet() {
        val tab = currentTab() ?: return
        val sheet = BottomSheetDialog(this)
        val dark = isCurrentlyDark()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 28, 32, 36)
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(if (dark) Color.parseColor("#161B22") else Color.WHITE)
        }

        val header = TextView(this).apply {
            text = "قائمة فيا ويب"
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#64748B"))
            setPadding(8, 0, 8, 24)
        }
        root.addView(header)

        val grid = GridLayout(this).apply {
            columnCount = 4
            rowCount = 2
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val isWeb = tab.currentUrl.startsWith("http://") || tab.currentUrl.startsWith("https://")
        val bookmarked = isBookmarked(tab.currentUrl)

        val items = listOf(
            Triple(if (bookmarked) "★ محفوظة" else "☆ مفضلة", bookmarked) {
                if (isWeb) {
                    toggleBookmark(tab.title, tab.currentUrl)
                }
                sheet.dismiss()
            },
            Triple("📖 وضع القراءة", false) {
                sheet.dismiss()
                if (isWeb) openReaderMode(tab)
            },
            Triple(if (darkModeEnabled) "☀ نهاري" else "🌙 ليلي", darkModeEnabled) {
                darkModeEnabled = !darkModeEnabled
                saveSettings()
                sheet.dismiss()
                applyNightModePreference()
                recreate()
            },
            Triple("🕶 تبويب خفي", tab.isIncognito) {
                createNewTab(HOME_URL, isIncognito = true)
                sheet.dismiss()
            },
            Triple("🛡 مانع إعلانات", adBlockEnabled) {
                adBlockEnabled = !adBlockEnabled
                saveSettings()
                sheet.dismiss()
                if (isWeb) tab.webView.reload()
                Toast.makeText(
                    this,
                    if (adBlockEnabled) "تم تفعيل مانع الإعلانات" else "تم إيقاف مانع الإعلانات",
                    Toast.LENGTH_SHORT
                ).show()
            },
            Triple("🖼 بدون صور", noImagesEnabled) {
                noImagesEnabled = !noImagesEnabled
                saveSettings()
                tabs.forEach { applyWebViewSettings(it.webView) }
                sheet.dismiss()
                if (isWeb) tab.webView.reload()
            },
            Triple("💻 سطح المكتب", desktopModeEnabled) {
                desktopModeEnabled = !desktopModeEnabled
                saveSettings()
                tabs.forEach { applyWebViewSettings(it.webView) }
                sheet.dismiss()
                if (isWeb) tab.webView.reload()
            },
            Triple("🕒 السجل والمفضلة", false) {
                sheet.dismiss()
                showBookmarksAndHistoryDialog(tab)
            }
        )

        items.forEach { (label, active, onClick) ->
            val cell = TextView(this).apply {
                text = label
                textSize = 12f
                gravity = Gravity.CENTER
                setPadding(12, 28, 12, 28)
                setTextColor(
                    when {
                        active -> Color.parseColor("#2563EB")
                        dark -> Color.parseColor("#E2E8F0")
                        else -> Color.parseColor("#1E293B")
                    }
                )
                val bg = GradientDrawable().apply {
                    cornerRadius = 24f
                    setColor(
                        when {
                            active && dark -> Color.parseColor("#1E3A5F")
                            active -> Color.parseColor("#EFF6FF")
                            dark -> Color.parseColor("#0D1117")
                            else -> Color.parseColor("#F8FAFC")
                        }
                    )
                    setStroke(1, if (active) Color.parseColor("#2563EB") else Color.parseColor("#2264748B"))
                }
                background = bg
                val params = GridLayout.LayoutParams().apply {
                    width = 0
                    height = ViewGroup.LayoutParams.WRAP_CONTENT
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                    setMargins(8, 8, 8, 8)
                }
                layoutParams = params
                setOnClickListener { onClick() }
            }
            grid.addView(cell)
        }
        root.addView(grid)

        val bottomRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 20, 0, 0)
        }
        bottomRow.addView(makeActionPillButton("الصفحة الرئيسية", false, dark) {
            loadHomePage(tab)
            sheet.dismiss()
        })
        bottomRow.addView(makeActionPillButton("محرك البحث", false, dark) {
            sheet.dismiss()
            showSearchEnginePicker(tab)
        })
        root.addView(bottomRow)

        sheet.setContentView(root)
        sheet.show()
    }

    private fun makeActionPillButton(
        label: String,
        primary: Boolean,
        dark: Boolean,
        onClick: () -> Unit
    ): TextView {
        return TextView(this).apply {
            text = label
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(24, 24, 24, 24)
            setTextColor(
                when {
                    primary -> Color.WHITE
                    dark -> Color.parseColor("#E2E8F0")
                    else -> Color.parseColor("#1E293B")
                }
            )
            val bg = GradientDrawable().apply {
                cornerRadius = 22f
                setColor(
                    when {
                        primary -> Color.parseColor("#2563EB")
                        dark -> Color.parseColor("#0D1117")
                        else -> Color.parseColor("#F1F5F9")
                    }
                )
            }
            background = bg
            val lp = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            lp.marginStart = 8
            lp.marginEnd = 8
            layoutParams = lp
            setOnClickListener { onClick() }
        }
    }

    private fun openReaderMode(tab: BrowserTab) {
        val js = """
            (function() {
              var root = document.querySelector('article') || document.querySelector('main') || document.body;
              var title = document.title || '';
              var parts = [];
              root.querySelectorAll('h1,h2,h3,p,li,blockquote').forEach(function(el) {
                var t = (el.innerText || '').trim();
                if (t.length > 20) parts.push(t);
              });
              return JSON.stringify({ title: title, text: parts.join('\n\n') });
            })();
        """.trimIndent()

        tab.webView.evaluateJavascript(js) { raw ->
            try {
                val jsonString = JSONTokener(raw).nextValue() as? String
                if (jsonString.isNullOrBlank()) {
                    Toast.makeText(this, "تعذر تفعيل وضع القراءة لهذه الصفحة", Toast.LENGTH_SHORT).show()
                    return@evaluateJavascript
                }
                val cleaned = JSONObject(jsonString)
                val title = cleaned.optString("title", tab.title)
                val body = cleaned.optString("text", "")
                if (body.isBlank()) {
                    Toast.makeText(this, "لم يتم العثور على نص مقال للعرض", Toast.LENGTH_SHORT).show()
                    return@evaluateJavascript
                }
                AlertDialog.Builder(this)
                    .setTitle(title)
                    .setMessage(body)
                    .setPositiveButton("إغلاق", null)
                    .show()
            } catch (_: Exception) {
                Toast.makeText(this, "تعذر تفعيل وضع القراءة لهذه الصفحة", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showSearchEnginePicker(tab: BrowserTab) {
        val names = arrayOf("Google", "DuckDuckGo", "Bing", "ويكيبيديا العربية")
        val ids = arrayOf("google", "duckduckgo", "bing", "wikipedia")
        val currentIdx = ids.indexOf(searchEngine).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle("محرك البحث الافتراضي")
            .setSingleChoiceItems(names, currentIdx) { dialog, which ->
                searchEngine = ids[which]
                saveSettings()
                if (tab.currentUrl == HOME_URL) {
                    loadHomePage(tab)
                }
                dialog.dismiss()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun isBookmarked(url: String): Boolean {
        val arr = JSONArray(prefs.getString("bookmarks", "[]") ?: "[]")
        for (i in 0 until arr.length()) {
            if (arr.optJSONObject(i)?.optString("url") == url) return true
        }
        return false
    }

    private fun toggleBookmark(title: String, url: String) {
        val arr = JSONArray(prefs.getString("bookmarks", "[]") ?: "[]")
        val updated = JSONArray()
        var removed = false
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            if (obj.optString("url") == url) {
                removed = true
            } else {
                updated.put(obj)
            }
        }
        if (!removed) {
            val item = JSONObject().apply {
                put("title", title)
                put("url", url)
            }
            updated.put(item)
        }
        prefs.edit().putString("bookmarks", updated.toString()).apply()
        Toast.makeText(
            this,
            if (removed) "تمت الإزالة من المفضلة" else "تم الحفظ في المفضلة",
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun addToHistory(title: String, url: String) {
        val arr = JSONArray(prefs.getString("history", "[]") ?: "[]")
        val updated = JSONArray()
        updated.put(JSONObject().apply {
            put("title", title)
            put("url", url)
        })
        for (i in 0 until arr.length()) {
            if (updated.length() >= 80) break
            val obj = arr.optJSONObject(i) ?: continue
            if (obj.optString("url") != url) {
                updated.put(obj)
            }
        }
        prefs.edit().putString("history", updated.toString()).apply()
    }

    private fun showBookmarksAndHistoryDialog(tab: BrowserTab) {
        val bmArr = JSONArray(prefs.getString("bookmarks", "[]") ?: "[]")
        val histArr = JSONArray(prefs.getString("history", "[]") ?: "[]")

        val titles = mutableListOf<String>()
        val urls = mutableListOf<String>()

        for (i in 0 until bmArr.length()) {
            val o = bmArr.optJSONObject(i) ?: continue
            titles.add("★ ${o.optString("title")}")
            urls.add(o.optString("url"))
        }
        for (i in 0 until histArr.length()) {
            val o = histArr.optJSONObject(i) ?: continue
            titles.add("🕒 ${o.optString("title")}")
            urls.add(o.optString("url"))
        }

        if (titles.isEmpty()) {
            Toast.makeText(this, "المفضلة والسجل فارغان حالياً", Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("المفضلة والسجل")
            .setItems(titles.toTypedArray()) { _, which ->
                navigateInput(tab, urls[which])
            }
            .setNeutralButton("مسح السجل") { _, _ ->
                prefs.edit().putString("history", "[]").apply()
                Toast.makeText(this, "تم مسح سجل التصفح", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("إغلاق", null)
            .show()
    }

    private fun startFileDownload(
        url: String,
        userAgent: String,
        contentDisposition: String,
        mimetype: String
    ) {
        try {
            val request = DownloadManager.Request(Uri.parse(url))
            val filename = URLUtil.guessFileName(url, contentDisposition, mimetype)
            request.setMimeType(mimetype)
            request.addRequestHeader("User-Agent", userAgent)
            request.setTitle(filename)
            request.setDescription("جارٍ التنزيل عبر فيا ويب")
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)

            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "بدأ تنزيل $filename", Toast.LENGTH_SHORT).show()
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: Exception) {
                Toast.makeText(this, "تعذر بدء التنزيل", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun buildStartPageHtml(isIncognito: Boolean): String {
        val dark = isCurrentlyDark()
        val bg = if (dark) "#0D1117" else "#F7F8FA"
        val card = if (dark) "#161B22" else "#FFFFFF"
        val border = if (dark) "#30363D" else "#E2E8F0"
        val text = if (dark) "#F1F5F9" else "#0F172A"
        val muted = if (dark) "#94A3B8" else "#64748B"

        val heading = if (isIncognito) "تصفح خفي" else "فيا ويب"
        val sub = if (isIncognito) "لا يتم حفظ سجل التصفح في هذا التبويب" else "متصفح خفيف ومباشر على محرك WebView"

        val engineOptions = listOf(
            "google" to "جوجل",
            "duckduckgo" to "دك دك غو",
            "bing" to "بينج",
            "wikipedia" to "ويكيبيديا"
        ).joinToString("") { (id, label) ->
            val sel = if (id == searchEngine) "selected" else ""
            "<option value=\"$id\" $sel>$label</option>"
        }

        val tiles = listOf(
            Triple("ويكيبيديا", "https://ar.wikipedia.org/", "#334155"),
            Triple("ScriptBlox", "https://scriptblox.com/", "#2563EB"),
            Triple("GitHub", "https://github.com/", "#0F172A"),
            Triple("الجزيرة نت", "https://www.aljazeera.net/", "#B45309"),
            Triple("Hacker News", "https://news.ycombinator.com/", "#C2410C"),
            Triple("Example", "https://example.com/", "#0F766E")
        ).joinToString("") { (name, url, color) ->
            val initial = name.first().uppercaseChar()
            """
            <a class="tile" href="$url">
              <span class="badge" style="background:$color">$initial</span>
              <span class="label">$name</span>
            </a>
            """.trimIndent()
        }

        return """
        <!doctype html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
            body { margin: 0; min-height: 100vh; background: $bg; color: $text; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; }
            .wrap { width: 100%; max-width: 460px; text-align: center; }
            h1 { margin: 0 0 6px; font-size: 26px; font-weight: 700; }
            p.sub { margin: 0 0 24px; font-size: 13px; color: $muted; }
            form.search { display: flex; align-items: center; gap: 6px; background: $card; border: 1px solid $border; border-radius: 16px; padding: 6px; margin-bottom: 28px; }
            select { background: transparent; color: $muted; border: 0; font-size: 12px; padding: 8px 6px; outline: none; }
            input { flex: 1; min-width: 0; background: transparent; color: $text; border: 0; font-size: 14px; padding: 10px 6px; outline: none; }
            button { background: #2563EB; color: #fff; border: 0; border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            a.tile { text-decoration: none; color: $text; background: $card; border: 1px solid $border; border-radius: 16px; padding: 14px 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
            .badge { width: 38px; height: 38px; border-radius: 12px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
            .label { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
            .stats { margin-top: 22px; font-size: 12px; color: $muted; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1>$heading</h1>
            <p class="sub">$sub</p>
            <form class="search" action="${HOME_BASE_URL}go" method="get">
              <select name="engine">$engineOptions</select>
              <input name="q" type="text" placeholder="ابحث أو أدخل رابطاً…" autocomplete="off" />
              <button type="submit">انتقال</button>
            </form>
            <div class="grid">$tiles</div>
            <div class="stats">مانع الإعلانات ${if (adBlockEnabled) "مفعّل" else "متوقف"} · تم حظر ${blockedCount.get()} عنصراً</div>
          </div>
        </body>
        </html>
        """.trimIndent()
    }

    companion object {
        private const val HOME_URL = "via://home"
        private const val HOME_BASE_URL = "https://viaweb.local/"
        private const val MOBILE_UA =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
        private const val DESKTOP_UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

        private val AD_HOSTS = listOf(
            "doubleclick.net",
            "googlesyndication.com",
            "googleadservices.com",
            "googletagmanager.com",
            "google-analytics.com",
            "adnxs.com",
            "taboola.com",
            "outbrain.com",
            "criteo.com",
            "scorecardresearch.com",
            "amazon-adsystem.com",
            "pubmatic.com",
            "rubiconproject.com",
            "adsafeprotected.com"
        )
    }
}
