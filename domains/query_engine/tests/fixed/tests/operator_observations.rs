// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

use std::sync::{Arc, Mutex};

use quent_dynamic_attributes::{DynamicAttribute, DynamicValue};
use quent_model::EventCallback;
use quent_query_engine_analyzer::ui::UiAnalyzer;
use quent_query_engine_fixed as fixed;
use quent_simulator_analyzer::SimulatorUiAnalyzer;
use quent_simulator_instrumentation::SimulatorContext;

#[test]
fn query_bundle_retains_arbitrary_observations_in_timestamp_order() {
    let recorded = Arc::new(Mutex::new(Vec::new()));
    {
        let captured = Arc::clone(&recorded);
        let context = SimulatorContext::try_new(EventCallback::new(move |event| {
            captured.lock().unwrap().push(event);
        }))
        .unwrap();
        fixed::emit(&context);
    }

    let events = std::mem::take(&mut *recorded.lock().unwrap());
    let analyzer = SimulatorUiAnalyzer::try_new(fixed::ENGINE, events.into_iter()).unwrap();
    let bundle = analyzer.query_bundle(fixed::QUERY).unwrap();
    let observations = &bundle.entities.operators[&fixed::PHYS_FINAL_AGG].observations;

    assert_eq!(
        observations
            .iter()
            .map(|observation| observation.kind.as_str())
            .collect::<Vec<_>>(),
        ["algorithm.choice", "vendor.snapshot"]
    );
    assert!((observations[0].time_s - 2.8).abs() < 1e-12);
    assert!((observations[1].time_s - 2.9).abs() < 1e-12);
    assert_eq!(
        observations[0].custom_attributes,
        [
            DynamicAttribute::string("zChoice", "left"),
            DynamicAttribute::null("alpha_choice"),
            DynamicAttribute::u64("repeat", 1),
            DynamicAttribute::u64("repeat", 2),
        ]
    );
    assert_eq!(
        observations[1].custom_attributes,
        [DynamicAttribute::u64("retained_rows", 42)]
    );
}

#[test]
fn query_bundle_retains_producer_information_order_and_repeated_keys() {
    let recorded = Arc::new(Mutex::new(Vec::new()));
    {
        let captured = Arc::clone(&recorded);
        let context = SimulatorContext::try_new(EventCallback::new(move |event| {
            captured.lock().unwrap().push(event);
        }))
        .unwrap();
        fixed::emit(&context);
    }

    let events = std::mem::take(&mut *recorded.lock().unwrap());
    let analyzer = SimulatorUiAnalyzer::try_new(fixed::ENGINE, events.into_iter()).unwrap();
    let bundle = analyzer.query_bundle(fixed::QUERY).unwrap();
    let information = &bundle.entities.operators[&fixed::PHYS_FINAL_AGG]
        .statistics
        .as_ref()
        .unwrap()
        .information;

    assert_eq!(
        information
            .iter()
            .map(|group| group.heading.as_str())
            .collect::<Vec<_>>(),
        ["zeta_2", "Alpha 10"]
    );
    assert_eq!(
        information[0]
            .items
            .iter()
            .map(|item| item.key.as_str())
            .collect::<Vec<_>>(),
        ["mixedCase", "alpha_value", "repeat", "repeat"]
    );
    assert_eq!(information[0].items[1].value, None);
    assert_eq!(
        information[0].items[2].value,
        Some(DynamicValue::String("first".to_string()))
    );
    assert_eq!(
        information[0].items[3].value,
        Some(DynamicValue::String("second".to_string()))
    );
    assert_eq!(
        information[1]
            .items
            .iter()
            .map(|item| item.key.as_str())
            .collect::<Vec<_>>(),
        ["numeric_10", "unknown_field"]
    );
}
