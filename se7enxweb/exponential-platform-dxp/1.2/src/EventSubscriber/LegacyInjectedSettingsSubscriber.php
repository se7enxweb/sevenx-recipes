<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use eZ\Publish\Core\MVC\Legacy\Event\PreBuildKernelEvent;
use eZ\Publish\Core\MVC\Legacy\LegacyEvents;
use eZ\Publish\Core\MVC\Symfony\SiteAccess;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Injects INI settings into the legacy kernel at boot time.
 *
 * Configured via parameters in config/packages/ez_publish_legacy.yaml:
 *
 *   parameters:
 *     # Global — applied to every siteaccess
 *     app.legacy.injected_settings:
 *       'file.ini/SectionName/SettingName': value
 *     app.legacy.injected_merge_settings:
 *       'file.ini/SectionName/ArraySetting': [value1, value2]
 *
 *     # Per-siteaccess — applied only when the named siteaccess is active
 *     app.legacy.siteaccess_injected_settings:
 *       my_siteaccess:
 *         'file.ini/SectionName/SettingName': value
 *     app.legacy.siteaccess_injected_merge_settings:
 *       my_siteaccess:
 *         'file.ini/SectionName/ArraySetting': [value1, value2]
 */
final class LegacyInjectedSettingsSubscriber implements EventSubscriberInterface
{
    // Plain properties, no constructor promotion: the 4.6 projects run on PHP 7.4 and later
    private array $injectedSettings;

    private array $injectedMergeSettings;

    private array $siteaccessInjectedSettings;

    private array $siteaccessInjectedMergeSettings;

    private SiteAccess $siteAccess;

    private RequestStack $requestStack;

    public function __construct(
        array $injectedSettings,
        array $injectedMergeSettings,
        array $siteaccessInjectedSettings,
        array $siteaccessInjectedMergeSettings,
        SiteAccess $siteAccess,
        RequestStack $requestStack
    ) {
        $this->injectedSettings = $injectedSettings;
        $this->injectedMergeSettings = $injectedMergeSettings;
        $this->siteaccessInjectedSettings = $siteaccessInjectedSettings;
        $this->siteaccessInjectedMergeSettings = $siteaccessInjectedMergeSettings;
        $this->siteAccess = $siteAccess;
        $this->requestStack = $requestStack;
    }

    public static function getSubscribedEvents(): array
    {
        // Priority 64: runs after the built-in LegacyMapper/Configuration and LegacyBundles
        // (priority 128): scalar values layer on top via left-hand precedence of array union (+),
        // array values are merged with what is already there.
        return [
            LegacyEvents::PRE_BUILD_LEGACY_KERNEL => ['onPreBuildKernel', 64],
        ];
    }

    public function onPreBuildKernel(PreBuildKernelEvent $event): void
    {
        // Resolve the current siteaccess name. The injected $siteAccess may be a
        // different object than the one SiteAccessListener updates, so prefer the
        // request attribute (set by SiteAccessListener before this event fires).
        $request = $this->requestStack->getCurrentRequest();
        $requestSA = $request !== null ? $request->attributes->get('siteaccess') : null;
        $saName = ($requestSA instanceof SiteAccess ? $requestSA->name : null)
            ?? $this->siteAccess->name;

        $settings = ($this->siteaccessInjectedSettings[$saName] ?? []) + $this->injectedSettings;
        $mergeSettings = ($this->siteaccessInjectedMergeSettings[$saName] ?? []) + $this->injectedMergeSettings;

        if (!empty($settings)) {
            $event->getParameters()->set(
                'injected-settings',
                $settings + (array) $event->getParameters()->get('injected-settings'),
            );
        }

        if (!empty($mergeSettings)) {
            // Array settings are merged, not replaced: the bridge has already injected the
            // legacy extensions of the registered bundles into ActiveExtensions (priority 128),
            // and a union (+) on the same key would drop them.
            $existing = (array) $event->getParameters()->get('injected-merge-settings');
            foreach ($mergeSettings as $key => $values) {
                if (isset($existing[$key]) && is_array($existing[$key]) && is_array($values)) {
                    $values = array_values(array_unique(array_merge($values, $existing[$key])));
                }
                $existing[$key] = $values;
            }
            $event->getParameters()->set('injected-merge-settings', $existing);
        }
    }
}
